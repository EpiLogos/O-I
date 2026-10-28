// Messages (manual §19.24, ai-kit:messages): where you talk to your agents, in every mode. Born on the rail, it opens full in a pane:
// your agents and groups down the side, each with its face and how it stands, and the conversation of the one you pick beside them.
// The conversation is the Thread's own Full (software-factory:thread, §19.4), carried under the prefix `conv.`, so an agent has one
// conversation wherever it is shown. Live's nearest: none; the browser's list beside a clip's editor is the shape.
//
// Owners, keyed on their paths:
//   agents    [{id, name, for, pattern?, state, where, model, last, at, unread, thread?}]: pattern is the agent's type (§25.6), read from its card; the Positions of your World with their occupancy, current
//             work and undelivered Communiques (AIKit `aikit gateway who --json`, aikit.population-reading/v1). state is working ·
//             waiting · stalled · rest (rest: no occupant now; what you send waits for its next run). where is {mode, track, workcell}.
//             `thread` is that agent's conversation (`aikit gateway conversation`), as the Thread's rows.
//   groups    [{id, name, for, members: [agent id], join, last, at, unread}]: your groups, Central's agent sets (`central.agent-set.list
//             {scope}`, root and the project's; messagesBinding.ts groupsOf), each with its members at the Positions their agents occupy.
//             `aikit gateway team` acts on one admitted member's delivery and lists no groups.
//   gateway   {state, waiting}: the Agency gateway's own reading (§19.10), for its mark in the head.
//   conv.*    the open conversation, in the Thread's keys (thread, sessions, draft, input, sent…).
// Writes: conv.sent sends a Communique to the open agent (`aikit gateway send`); a message dragged to a track becomes work
// (`aikit gateway delegate`). Make is Central's agent-creation chain: `agent-profile.express` writes a proposed profile from your words
// (scope, world_ref, intent_expression, ratified_world_refs → role, purpose, sources; recognition unrecognised), answered on `proposal`;
// Accept is `agent-profile.accept` (scope, profile_ref, expected_revision, expected_content_digest), Change `agent-profile.save`, Discard
// `agent-profile.remove`. A group is `central.agent-set.propose` (scope, ref, revision, members), then `central.agent-set.save`.
// The shell holds: open (the agent or group shown), show, order, search, and the card's fields (new.*).
import type {ReactNode} from 'react'
import {Action, Chooser, Radio, Readout, TextField, Tile, type LightState, type Option} from '../../sdk/panel'
import {NONE, has, json, prefixed, railAndPane, scoped, st, strOf, type ViewProps} from './design'
import {design as thread} from './thread'
import {CreatureFace, type RunState} from '../faces'
import './ai-kit__messages.css'

type V = ViewProps['v']
type State = 'working' | 'waiting' | 'stalled' | 'rest'
interface Where {readonly mode?: string; readonly track?: string; readonly workcell?: string}
interface Agent {readonly id: string; readonly name: string; readonly for?: string; readonly pattern?: string; readonly state?: State; readonly where?: Where; readonly model?: string
  readonly last?: string; readonly at?: string; readonly unread?: number; readonly used?: number; readonly cap?: number; readonly age?: number; readonly thread?: unknown[]}
interface Group {readonly id: string; readonly name: string; readonly for?: string; readonly members: readonly string[]; readonly join?: string
  readonly last?: string; readonly at?: string; readonly unread?: number}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const STATES: readonly State[] = ['working', 'waiting', 'stalled', 'rest']
const agentsOf = (v: V): Agent[] | undefined => (has(v, 'agents') ? json<unknown[]>(v, 'agents', []).filter((a): a is Agent => rec(a) && typeof a.id === 'string' && typeof a.name === 'string')
  .map(a => ({...a, state: STATES.includes(a.state as State) ? a.state : undefined})) : undefined)
const groupsOf = (v: V): Group[] | undefined => (has(v, 'groups') ? json<unknown[]>(v, 'groups', []).filter((g): g is Group => rec(g) && typeof g.id === 'string' && Array.isArray(g.members)) : undefined)

const STATE_WORD: Readonly<Record<State, string>> = {working: 'working', waiting: 'waits for you', stalled: 'stalled', rest: 'at rest'}
/** Needs you first: waiting and stalled, then by the last message. */
const NEED: Readonly<Record<State, number>> = {waiting: 0, stalled: 1, working: 2, rest: 3}
function ordered(v: V, agents: readonly Agent[]): Agent[] {
  const order = strOf(v, 'order') ?? 'need', q = (strOf(v, 'search') ?? '').toLowerCase()
  const kept = agents.filter(a => !q || a.name.toLowerCase().includes(q))
  const byAt = (a: Agent, b: Agent) => (b.at ?? '').localeCompare(a.at ?? '')
  return [...kept].sort(order === 'name' ? (a, b) => a.name.localeCompare(b.name) : order === 'latest' ? byAt
    : (a, b) => (NEED[a.state ?? 'rest'] - NEED[b.state ?? 'rest']) || byAt(a, b))
}

/** How an agent stands, as the creature's run state (§25.6): at rest it lies as a run that has not started. */
const RUN: Readonly<Record<State, RunState>> = {working: 'acting', waiting: 'waiting', stalled: 'stalled', rest: 'queued'}

/** An agent's face: its type's creature, in the posture of how it stands, ringed by its state. An agent with no type yet shows its
 * initial. Faces in a list hold still but for their posture (reduced motion); the creature breathes only where it stands alone. */
function Face({agent, size = 26, still = true}: {agent: Agent | undefined; size?: number; still?: boolean}) {
  const state = agent?.state
  return <span className="ms-face" data-state={state} data-type={agent?.pattern ? 'creature' : undefined} style={{width: size, height: size, fontSize: Math.round(size * .42)}} aria-hidden="true">
    {agent?.pattern ? <CreatureFace pattern={agent.pattern} state={RUN[state ?? 'rest']} size={size} reduced={still} />
      : agent ? agent.name.replace(/^@/, '').slice(0, 1).toUpperCase() : '·'}
  </span>
}

/** The conversation shown: the open agent's own rows, laid over the Thread's keys. */
function conversation(p: ViewProps, agent: Agent | undefined): ViewProps {
  const c = scoped(p, 'conv.')
  if (!agent?.thread) return c
  return {...c, v: {...c.v, ...(agent.age === undefined ? {} : {age: agent.age}), thread: JSON.stringify(agent.thread), session: agent.id,
    sessions: JSON.stringify([{id: agent.id, name: [agent.where?.mode, agent.where?.track, agent.where?.workcell].filter(Boolean).join(' · ') || agent.name, short: agent.name, agent: agent.name,
    model: agent.model, used: agent.used, cap: agent.cap}])}}
}

const SHOWS: readonly Option<string>[] = [{value: 'both', label: 'All', does: 'Agents and groups.'}, {value: 'agents', label: 'Agents'}, {value: 'groups', label: 'Groups'}]
const ORDERS: readonly Option<string>[] = [{value: 'need', label: 'Needs you', does: 'Agents that wait for you or have stalled first, then by the last message.'},
  {value: 'latest', label: 'Latest', does: 'By the last message.'}, {value: 'name', label: 'Name', does: 'By name.'}]

function List({p, agents, groups}: {p: ViewProps; agents: readonly Agent[] | undefined; groups: readonly Group[] | undefined}) {
  const v = p.v, show = strOf(v, 'show') ?? 'both', open = strOf(v, 'open'), byId = new Map((agents ?? []).map(a => [a.id, a]))
  const row = (id: string, face: ReactNode, name: string, line: string | undefined, sub: string | undefined, unread: number | undefined, state?: State) =>
    <button key={id} type="button" className="ms-row" aria-pressed={id === open} data-state={state} onClick={() => p.set('open', id)}
      data-i={`${name}|${line ?? ''} Click to open the conversation.`}>
      {face}
      <span className="ms-row-text"><b>{name}</b><span className="ms-row-for">{line ?? NONE}</span><span className="ms-row-last">{sub ?? NONE}</span></span>
      {!!unread && <span className="ms-unread">{unread}</span>}
    </button>
  return <div className="ms-list" role="listbox" aria-label="Your agents and groups">
    {agents === undefined && <p className="ms-none">No reading of your agents.</p>}
    {show !== 'groups' && agents && ordered(v, agents).map(a => row(a.id, <Face agent={a} size={34} />, a.name, a.for,
      `${a.state ? STATE_WORD[a.state] : NONE}${a.where?.mode ? ` · ${a.where.mode}` : ''} · ${a.last ?? NONE}`, a.unread, a.state))}
    {show !== 'agents' && groups?.map(g => row(g.id, <span className="ms-faces">{g.members.slice(0, 3).map(m => <Face key={m} agent={byId.get(m)} size={18} />)}</span>,
      g.name, g.for, g.last, g.unread))}
  </div>
}

/** The card for a new agent (page new-agent) or group (page new-group). */
function Card({p, group}: {p: ViewProps; group: boolean}) {
  const v = p.v, field = (key: string) => strOf(v, `new.${key}`) ?? ''
  const types = json<string[]>(v, 'types', []).map(t => ({value: t, label: t}))
  const worlds = json<string[]>(v, 'worlds', []).map(t => ({value: t, label: t}))
  const skillsets = json<string[]>(v, 'skillsets', []).map(t => ({value: t, label: t}))
  // Central's answer to Make: the proposal it wrote from your words (agent-profile.express → role, purpose, world, sources).
  const proposal = json<{role?: string; purpose?: string; world?: string; sources?: string[]; revision?: string} | null>(v, 'proposal', null)
  if (proposal) return <div className="ms-card" aria-label={group ? 'The group Central proposes' : 'The agent Central proposes'}>
    <h3>{group ? 'Central proposes this group' : 'Central proposes this agent'}</h3>
    <Readout label="role" does="The role Central read from your words." value={proposal.role} />
    <p className="ms-card-purpose" data-i="Purpose|What the agent is for, as Central wrote it from your words.">{proposal.purpose ?? NONE}</p>
    <Readout label="world" does="The world the agent stands in." value={proposal.world} />
    <Readout label="may read" does="The sources the agent may read." value={proposal.sources?.length ? proposal.sources.join(', ') : undefined} />
    <div className="ms-card-do">
      <Action {...st(p, 'accept')} label="Accept" does="Keep the proposal in your roster. Until you accept, the agent stands proposed." onPress={() => { p.set('accept', proposal.revision ?? true); p.setPage('') }} />
      <Action label="Change" does="Edit a field before you accept." onPress={() => p.set('proposal', undefined)} />
      <Action {...st(p, 'discard')} label="Discard" does="Drop the proposal. Nothing is kept." onPress={() => { p.set('discard', proposal.revision ?? true); p.setPage('') }} />
    </div>
  </div>
  return <div className="ms-card" aria-label={group ? 'A new group' : 'A new agent'}>
    <h3>{group ? 'A new group' : 'A new agent'}</h3>
    <TextField label="For" does={group ? 'What the group is for, in your words.' : 'What the agent is for, in your words. Central reads its role, its purpose and what it may read from them.'} wide value={field('for')} onChange={x => p.set('new.for', x)} />
    {group
      ? <Readout label="members" does="Drag faces from the list onto the card to add them." value={field('members') || 'drag faces here'} />
      : <>
        <Chooser label="Works in" does="The world it belongs to. It works in that world's workcell." wide value={field('world')} options={worlds} onChange={x => p.set('new.world', x)} />
        <Radio label="Kept for" does="Whether the agent is yours alone or belongs to the project." value={field('scope') || 'root'}
          options={[{value: 'root', label: 'You'}, {value: 'project', label: 'The project'}]} onChange={x => p.set('new.scope', x)} />
      </>}
    <Chooser label="Type" does="How it works: when it starts and stops, alone or in a crew, what it may change and whom it answers to. The type sets the face." wide
      value={field('type')} options={[{value: '', label: 'None until you choose'}, ...types]} onChange={x => p.set('new.type', x)} />
    {!group && <Chooser label="Carries" does="The practice it carries: a skillset from the browser." wide value={field('carries')} options={[{value: '', label: 'None'}, ...skillsets]} onChange={x => p.set('new.carries', x)} />}
    <div className="ms-card-do">
      <Action {...st(p, 'make')} label="Make" does={group ? 'Central proposes the group. You accept it next.' : 'Central writes the agent as a proposal from your words. You accept it next.'}
        onPress={field('for') ? () => p.set('make', field('for')) : undefined} />
      <Action label="Cancel" does="Close the card. Nothing is written." onPress={() => p.setPage('')} />
    </div>
  </div>
}

function Pane({p}: {p: ViewProps}) {
  const v = p.v, agents = agentsOf(v), groups = groupsOf(v), open = agents?.find(a => a.id === strOf(v, 'open')), gw = rec(json<unknown>(v, 'gateway', undefined)) ? json<{state?: string; waiting?: number}>(v, 'gateway', {}) : undefined
  return <div className="ms-pane">
    <div className="ms-head">
      <b>Messages</b>
      <Chooser {...st(p, 'show')} does="What the list holds." value={strOf(v, 'show') ?? 'both'} options={SHOWS} onChange={x => p.set('show', x)} />
      <Chooser {...st(p, 'order')} does="How the list is sorted." value={strOf(v, 'order') ?? 'need'} options={ORDERS} onChange={x => p.set('order', x)} />
      <TextField does="Filter the list by name." value={strOf(v, 'search') ?? ''} placeholder="Search" onChange={x => p.set('search', x)} />
      <Action label="+ Agent" does="Make a new agent: a card opens in the pane." onPress={() => p.setPage('new-agent')} />
      <Action label="+ Group" does="Make a group of your agents." onPress={() => p.setPage('new-group')} />
      <span className="ms-gateway" data-state={gw?.state?.toLowerCase()} data-i={`Agency gateway|Carries what you write here. ${gw ? `${gw.state ?? NONE}, ${gw.waiting ?? NONE} waiting.` : 'No reading.'} ▸ expands it.`}>
        <i />Agency gateway · {gw?.state ?? NONE}{gw?.waiting ? ` · ${gw.waiting} waiting` : ''} ▸</span>
    </div>
    <div className="ms-body">
      <List p={p} agents={agents} groups={groups} />
      <div className="ms-conv">
        {p.page === 'new-agent' || p.page === 'new-group' ? <Card p={p} group={p.page === 'new-group'} />
          : <>
            {open ? <div className="ms-thread">{thread.full(conversation(p, open))}</div>
              : <p className="ms-none">{agents === undefined ? 'No reading of your agents.' : 'Pick an agent in the list to open its conversation.'}</p>}
          </>}
      </div>
    </div>
  </div>
}

function TileView({p}: {p: ViewProps}) {
  const v = p.v, agents = agentsOf(v), open = agents?.find(a => a.id === strOf(v, 'open')), draft = strOf(v, 'conv.draft') ?? '', sent = st(p, 'conv.sent')
  const rows = open?.thread?.filter((r): r is {who?: string; kind?: string; text?: string} => rec(r) && (r.kind === 'you' || r.kind === 'agent')).slice(-2) ?? []
  const light: LightState = agents === undefined ? 'unknown' : 'lit'
  return <Tile title="Messages" light={light} span={2} onFull={p.nav.full}>
    <div className="ms-tile">
      <div className="ms-tile-faces">{agents === undefined ? <span className="ms-none">No reading of your agents.</span>
        : ordered({...v, order: 'need', search: ''}, agents).slice(0, 6).map(a => <button key={a.id} type="button" className="ms-tile-face" aria-pressed={a.id === open?.id}
          data-i={`${a.name}|${a.state ? STATE_WORD[a.state] : NONE}. Click to switch to its conversation.`} onClick={() => p.set('open', a.id)}>
          <Face agent={a} size={28} />{!!a.unread && <span className="ms-dot" />}</button>)}</div>
      <div className="ms-tile-lines" aria-live="polite">{open ? rows.length ? rows.map((r, i) => <p key={i}><b>{r.kind === 'you' ? 'you' : r.who ?? open.name}</b> {r.text ?? NONE}</p>)
        : <p>{open.last ?? 'No messages yet.'}</p> : <p>Pick a face to talk.</p>}</div>
      <input className="ms-tile-composer" aria-label="Message" placeholder={open ? `Message ${open.name}` : 'Message'} value={draft} disabled={!open || !!sent.disabled}
        data-i="Composer|Type and press Enter to send it to the agent you picked."
        onChange={e => p.set('conv.draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && draft) { p.set('conv.sent', draft); p.set('conv.draft', '') } }} />
    </div>
  </Tile>
}

// The gallery's sample material. The views never read these constants: they arrive on `agents`, `groups` and `gateway`.
const NARA_ROWS = [
  {who: 'you', kind: 'you', text: 'What did this morning\'s sitting leave open?'},
  {who: 'Nara', kind: 'agent', text: 'Two threads: the dream of the stair, and the question you wrote at the close. I can set both on today\'s page.'},
  {who: 'Nara', kind: 'proposal', tool: 'Practice · today', text: 'Add the two open threads to today\'s page'},
]
const LEAD_ROWS = [
  {who: 'you', kind: 'you', text: 'Type-check the three roots and tell me what broke.'},
  {who: 'Flint', kind: 'agent', text: 'Two roots pass. The shell root fails on one import; I am reading it.'},
  {who: 'tool', kind: 'tool', tool: 'Bash', text: 'tsc --noEmit -p packages/live-shell/ui', state: 'waits', out: 'waits for an answer'},
  {who: 'Flint', kind: 'stall', tool: 'Bash', text: 'Flint wants to run a command · tsc --noEmit'},
]
const AGENTS = [
  {id: 'position:flint', name: 'Flint', pattern: 'ambush', for: 'Builds and checks the shell', state: 'stalled', where: {mode: 'Factory', track: 'dlw/build', workcell: 'env-1'}, model: 'claude-opus',
    last: 'Flint wants to run a command', at: '14:06', unread: 1, used: 7, cap: 12, age: 140, thread: LEAD_ROWS},
  {id: 'position:nara', name: 'Nara', pattern: 'home', for: 'Keeps your practice', state: 'waiting', where: {mode: 'Central', track: 'Practice', workcell: 'env-1'}, model: 'claude-sonnet',
    last: 'I can set both on today\'s page.', at: '14:02', unread: 2, used: 2, cap: 12, thread: NARA_ROWS},
  {id: 'position:kite', name: 'Kite', pattern: 'metamorph', for: 'Makes scenes from your sources', state: 'working', where: {mode: 'Expressions', track: 'The stair', workcell: 'env-2'}, model: 'claude-sonnet',
    last: 'Composing the third scene', at: '13:51'},
  {id: 'position:cairn', name: 'Cairn', pattern: 'watch', for: 'Reads the corpus with you', state: 'rest', where: {mode: 'Technē'}, model: 'claude-opus', last: 'The two readings agree up to 1934.', at: 'yesterday'},
  {id: 'position:lilt', name: 'Lilt', pattern: 'recruit', for: 'Finds what goes together', state: 'rest', model: 'claude-haiku', last: 'Three pairings for the Day.', at: 'Mon'},
]
const GROUPS = [{id: 'group:docs', name: 'Documentation', for: 'Writes, audits and judges the manual', members: ['position:kite', 'position:cairn', 'position:flint'], join: 'quorum',
  last: 'Cairn: the audit stands at two findings.', at: '12:40'}]

export const design = railAndPane({
  id: 'ai-kit:messages',
  title: 'Messages',
  kind: 'instrument',
  defaults: {
    open: 'position:nara', show: 'both', order: 'need', search: '',
    agents: JSON.stringify(AGENTS), groups: JSON.stringify(GROUPS), gateway: JSON.stringify({state: 'Ready', waiting: 3}),
    types: JSON.stringify(['Sense · Watch', 'Sense · Scout', 'Sense · Guard', 'Coordinate · Recruit', 'Coordinate · Quorum', 'Settle · Contest', 'Keep · Tend', 'Keep · Hold',
      'Carry · Relay', 'Carry · Home', 'Change · Metamorph']),
    worlds: JSON.stringify(['Practice', 'O-I', 'Archetypal-Earth', 'Quaternal-Logic']),
    skillsets: JSON.stringify(['central:documentation', 'central:core-development', 'aikit:project-author']),
    ...prefixed('conv.', {light: 'lit', toolRows: 'lines', subagents: 'linked', messages: 'all', input: 'steer', voice: false, draft: '', age: 6, writes: 'proposals'}),
  },
  fixtures: {
    'Two need you': {},
    'Flint has stalled': {open: 'position:flint'},
    'A new agent': {open: 'position:nara', 'new.for': 'Watches the build and tells me when it breaks', 'new.type': 'Sense · Watch', 'new.world': 'O-I'},
    'Central proposes': {open: 'position:nara', proposal: JSON.stringify({role: 'build-watcher', purpose: 'Watches the O-I build and tells you when a check breaks, with the failing step. It never changes the code.', world: 'O-I', sources: ['the O-I checks', 'the build log'], revision: 'r1'})},
    'No readings': {agents: undefined, groups: undefined, gateway: undefined, open: undefined},
  },
  firstPage: '',
  full: p => <Pane p={p} />,
  widget: p => <TileView p={p} />,
})
