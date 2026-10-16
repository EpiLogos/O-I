// Factory's clip (manual §19.1): a task on an agent session's track. Clip view puts how it launches and what follows it beside its
// log. The Clip panel holds its name, colour, state, turns and output style; Launch holds Launch (Once, Hold, Loop), Then, Hand off
// to and Quantize. A task has no tools, so the editor takes panel two's room. The Log lays each tool the agent used along the task's
// time, one lane per tool as notes lie on a piano roll's rows, with the steers you sent marked as lines and a stall marked where the
// output stopped; the events read as a list under the lanes. Envelopes set the Agent's Effort and Autonomy for this task only.
//
// The owner's material: `log` (JSON rows {at, kind, tool?, text, dur?, state?, heard?}; at and dur in seconds from the task's start;
// kind is tool | spawn | steer | say | stall), `elapsed` (seconds to the last output), `sessions` (JSON rows {id, name}: the
// hand-off's choices), and each envelope's steps on `env.agent.<control>` (JSON [[second, step]…]).
import {Chooser, Radio, TextField, type Option} from '../../sdk/panel'
import {numOf, strOf} from '../panels/design'
import {COLOURS, EnvelopeEditor, Fact, Fields, LaneGrid, Rows, Row, Rule, Said, Wide, choice, fit, read, write, type Block, type Lane, type Mark, type Point} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

interface Entry {readonly at: number; readonly kind: 'tool' | 'spawn' | 'steer' | 'say' | 'stall'; readonly tool?: string; readonly text: string; readonly dur?: number; readonly state?: 'runs' | 'waits'; readonly heard?: string}
const logOf = (v: ClipProps['v']) => read<Entry[]>(v, 'log', []).filter(e => Number.isFinite(e.at)).sort((a, b) => a.at - b.at)

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const STATE_WORD: Readonly<Record<string, string>> = {queued: 'Queued', running: 'Running', stalled: 'Stalled', stopped: 'Stopped', done: 'Done'}
const STATE_TONE = {queued: 'accent', running: 'value', stalled: 'stall', stopped: undefined, done: 'green'} as const
/** Every tool lane a log can hold, in the order the log draws them unfolded. */
const TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Web', 'Helpers', 'Messages'] as const
const laneOf = (e: Entry) => (e.kind === 'spawn' ? 'Helpers' : e.kind === 'say' ? 'Messages' : e.tool ?? 'Messages')

function Log(p: ClipProps) {
  const log = logOf(p.v)
  if (!log.length) return <Said>No reading of the task's log yet.</Said>
  const elapsed = numOf(p.v, 'elapsed') ?? Math.max(...log.map(e => e.at + (e.dur ?? 0)))
  const to = Math.max(60, Math.ceil((elapsed + 8) / 30) * 30)
  const used = new Set(log.filter(e => e.kind !== 'steer' && e.kind !== 'stall').map(laneOf))
  const lanes: Lane[] = (p.v.fold === false ? [...TOOLS] : TOOLS.filter(t => used.has(t))).map(t => ({id: t, label: t, key: 'name', marked: used.has(t)}))
  const state = strOf(p.v, 'state')
  const blocks: Block[] = log.filter(e => e.kind === 'tool' || e.kind === 'spawn' || e.kind === 'say').map(e => {
    const i = log.indexOf(e)
    const running = e.state === 'runs' && state === 'running' && i === log.length - 1
    return {id: `e${e.at}-${i}`, lane: laneOf(e), at: e.at, len: running ? undefined : Math.max(1, e.dur ?? 1.5), label: e.text,
      tone: e.kind === 'spawn' ? 'green' : e.kind === 'say' ? 'accent' : e.state === 'waits' && state === 'stalled' ? 'stall' : 'value',
      striped: e.state === 'waits' && state === 'stalled', does: `${clock(e.at)} · ${e.tool ?? e.kind}: ${e.text}`}
  })
  const marks: Mark[] = log.filter(e => e.kind === 'steer' || e.kind === 'stall').map(e => e.kind === 'steer'
    ? {at: e.at, label: `Steer: ${e.text}`, tone: 'accent', does: e.heard ?? 'Words you sent in the middle of the turn.'}
    : {at: e.at, label: `Stall: ${e.text}`, tone: 'stall', does: 'The output stopped here. The track lights a retry.'})
  if (state === 'running') marks.push({at: elapsed, label: 'Now', tone: 'value', does: 'The last output: the task runs on from here.'})
  const listH = Math.max(58, Math.round(p.room.h * 0.36))
  const laneH = Math.max(14, Math.min(24, Math.floor((p.room.h - 16 - listH) / Math.max(1, lanes.length))))
  return <LaneGrid lanes={lanes} blocks={blocks} marks={marks} from={0} to={to} major={30} minor={5} label={clock} keyW={64} laneH={laneH}
    highlight={false} selected={strOf(p.v, 'event')} onSelect={id => p.set('event', id)} w={p.room.w} h={p.room.h}
    name="Log" does="Each tool the agent used, along the task's time, one lane per tool. Lines mark your steers and where the output stopped. Press a tool to select it."
    under={<ul className="clv-list" aria-label="Events">
      {log.map((e, i) => <li key={i} data-tone={e.kind === 'steer' ? 'accent' : e.kind === 'stall' ? 'stall' : undefined}
        data-i={`${e.kind === 'tool' ? e.tool ?? 'Tool' : e.kind === 'spawn' ? 'Helper' : e.kind === 'steer' ? 'Steer' : e.kind === 'stall' ? 'Stall' : 'Message'}|${e.text}`}>
        <span className="clv-at">{clock(e.at)}</span>
        <span className="clv-chip">{e.kind === 'tool' ? e.tool : e.kind === 'spawn' ? 'helper' : e.kind}</span>
        <span className="clv-text">{e.text}</span>
        <span className="clv-tag">{e.kind === 'steer' ? e.heard ?? '' : e.dur !== undefined ? `${e.dur} s` : e.state === 'runs' ? 'runs' : e.state === 'waits' ? 'waits' : ''}</span>
      </li>)}
    </ul>} underH={listH} />
}

const EFFORT = ['Inherit', 'Low', 'Medium', 'High', 'Max'] as const
const AUTONOMY = ['Inherit', 'Suggest', 'Review', 'Auto'] as const
const CONTROLS: readonly Option<string>[] = [
  {value: 'effort', label: 'Effort', does: 'How hard the agent thinks in each turn of this task.'},
  {value: 'autonomy', label: 'Autonomy', does: 'How much the agent decides alone in this task.'},
]

function Envelopes(p: ClipProps) {
  const control = choice(p.v, 'env.control', 'effort') === 'autonomy' ? 'autonomy' : 'effort'
  const steps = control === 'effort' ? EFFORT : AUTONOMY
  const key = `env.agent.${control}`
  const log = logOf(p.v), elapsed = numOf(p.v, 'elapsed') ?? 60
  const to = Math.max(60, Math.ceil((elapsed + 8) / 30) * 30)
  const mode = choice(p.v, 'env.mode', 'automation') as 'automation' | 'modulation'
  return <EnvelopeEditor p={p} devices={[{value: 'agent', label: 'Agent'}]} device="agent" onDevice={() => undefined}
    controls={CONTROLS} control={control} onControl={x => p.set('env.control', x)} mode={mode} onMode={x => p.set('env.mode', x)}
    linked={p.v['env.linked'] !== false} onLinked={x => p.set('env.linked', x)} own={{start: 0, end: to, format: clock}}
    points={read<Point[]>(p.v, key, [])} onPoints={pts => write(p, key, pts)}
    min={0} max={steps.length - 1} steps={mode === 'modulation' ? ['−2', '−1', '0', '+1', '+2'] : steps} format={x => steps[Math.round(x)] ?? String(x)}
    from={0} to={to} major={30} minor={5} label={clock} w={p.room.w} h={p.room.h}
    behind={(w, h, keyW) => log.filter(e => e.kind === 'tool').map((e, i) => <rect key={i} className="clv-env-behind" x={keyW + e.at / to * (w - keyW)} width={Math.max(2, (e.dur ?? 1.5) / to * (w - keyW))} y={h - 10} height={4} />)} />
}

const SESSIONS = (v: ClipProps['v']): Option<string>[] => read<{id: string; name: string}[]>(v, 'sessions', []).map(s => ({value: s.id, label: s.name}))

function ClipPanel(p: ClipProps) {
  const state = strOf(p.v, 'state')
  const used = numOf(p.v, 'turns.used'), cap = numOf(p.v, 'turns.cap')
  return <Rows>
    <Row label="Name"><TextField label="Name" does="The task's name. It comes from the first message until you change it." value={strOf(p.v, 'name') ?? ''} onChange={x => p.set('name', x)} /></Row>
    <Row label="Colour"><Chooser label="Colour" does="The colour of the clip on the grid and the ruler. A task takes its session's colour." value={choice(p.v, 'colour')} options={COLOURS} onChange={x => p.set('colour', x)} /></Row>
    <Row label="State"><Fact label="State" does="How the task stands, as the session reports it." value={state ? STATE_WORD[state] ?? state : undefined}
      tone={state ? STATE_TONE[state as keyof typeof STATE_TONE] : undefined} /></Row>
    <Row label="Turns"><Fact label="Turns" does="The turns the task has used of the turns the agent's budget allows. The transport's time signature shows the same reading."
      value={used !== undefined && cap !== undefined ? `${used} of ${cap}` : undefined} /></Row>
    <Rule />
    <Wide><Radio label="Output style" does="How the agent writes for this task: plain, warm or terse." value={choice(p.v, 'style.register')} onChange={x => p.set('style.register', x)}
      options={[{value: 'plain', label: 'Plain'}, {value: 'warm', label: 'Warm'}, {value: 'terse', label: 'Terse'}]} /></Wide>
    <Wide><Radio label="Output form" does="The shape of what the agent writes for this task: technical, narrative or a list." value={choice(p.v, 'style.form')} onChange={x => p.set('style.form', x)}
      options={[{value: 'technical', label: 'Technical'}, {value: 'narrative', label: 'Narrative'}, {value: 'list', label: 'List'}]} /></Wide>
  </Rows>
}

function LaunchPanel(p: ClipProps) {
  const then = choice(p.v, 'then')
  return <>
    <Fields>
      <Wide><Radio label="Launch" does="Once runs the task one time. Hold keeps it ready while you hold the launch. Loop runs it again after each finish, until its stop condition or the cap."
        value={choice(p.v, 'launch')} onChange={x => p.set('launch', x)}
        options={[{value: 'once', label: 'Once', does: 'Runs the task one time.'}, {value: 'hold', label: 'Hold', does: 'Keeps the task ready while you hold the launch.'}, {value: 'loop', label: 'Loop', does: 'Runs the task again after each finish, until its stop condition or the cap.'}]} /></Wide>
      <Wide><Chooser label="Then" does="What follows the task: its follow action. Next task and Stop are Live's; Hand off moves the work to another session's track, which a Live follow action never does."
        value={then} onChange={x => p.set('then', x)} options={[{value: 'next', label: 'Next task'}, {value: 'handoff', label: 'Hand off'}, {value: 'stop', label: 'Stop'}]} /></Wide>
      <Wide><Chooser label="Hand off to" does="The session that continues when Then is Hand off." value={choice(p.v, 'handoff')} options={SESSIONS(p.v)} onChange={x => p.set('handoff', x)}
        disabled={then === 'handoff' ? undefined : 'Set Then to Hand off first.'} /></Wide>
    </Fields>
    <Rule />
    <Fields>
      <Wide><Chooser label="Quantize" does="When a launch or a steer lands. Global follows the transport's Quantize." value={choice(p.v, 'quantize')} onChange={x => p.set('quantize', x)}
        options={[{value: 'global', label: 'Global'}, {value: 'now', label: 'Now'}, {value: 'next tool', label: 'Next tool'}, {value: 'next turn', label: 'Next turn'}]} /></Wide>
    </Fields>
    <Said>A task has no legato and no launch velocity.</Said>
  </>
}

const logBar = (p: ClipProps) => <>
  <Radio label="Lanes" does="Fold keeps only the lanes of the tools the agent used." value={p.v.fold === false ? 'all' : 'fold'} onChange={x => p.set('fold', x === 'fold')}
    options={[{value: 'fold', label: 'Fold', does: 'Only the tools the agent used.'}, {value: 'all', label: 'All tools', does: 'Every tool lane.'}]} />
</>

const corner = (p: ClipProps) => {
  const log = logOf(p.v), selected = strOf(p.v, 'event')
  const at = log.findIndex((e, i) => `e${e.at}-${i}` === selected)
  return at >= 0 ? <span className="clv-own" data-i={`Selected|${log[at]!.text}`}>{fit(`${clock(log[at]!.at)} ${log[at]!.tool ?? ''} ${log[at]!.text}`, 260)}</span> : null
}

const LOG = [
  {at: 0, kind: 'say', text: 'Write the hand-off fixtures for the bridge widgets.'},
  {at: 3, kind: 'tool', tool: 'Read', dur: 2, text: 'widgets/handoff.tsx · 214 lines'},
  {at: 6, kind: 'tool', tool: 'Grep', dur: 1, text: 'handoff fixtures · 9 files'},
  {at: 9, kind: 'tool', tool: 'Read', dur: 3, text: 'fixtures/README.md'},
  {at: 14, kind: 'tool', tool: 'Edit', dur: 4, text: 'fixtures/handoff.json · +42 −3'},
  {at: 21, kind: 'steer', text: 'Keep the old ids; only add new ones.', heard: 'heard at next tool'},
  {at: 23, kind: 'tool', tool: 'Edit', dur: 3, text: 'fixtures/handoff.json · ids kept'},
  {at: 29, kind: 'tool', tool: 'Bash', dur: 9, text: 'pnpm test bridge · 12 passed'},
  {at: 40, kind: 'spawn', dur: 14, text: 'test · full widget tests'},
  {at: 43, kind: 'say', text: 'Three beats: compose, settle, hand off.'},
  {at: 50, kind: 'steer', text: 'Also drop the old capture list from your reads.', heard: 'heard at next tool'},
  {at: 56, kind: 'tool', tool: 'Write', dur: 2, text: 'fixtures/capture.json'},
  {at: 61, kind: 'tool', tool: 'Bash', dur: 3, text: 'pnpm test bridge2 · 12 passed'},
  {at: 66, kind: 'tool', tool: 'Bash', state: 'runs', text: 'pnpm build widgets'},
]
const STALLED = [
  {at: 0, kind: 'say', text: 'Generate the fixtures for the widgets.'},
  {at: 2, kind: 'tool', tool: 'Read', dur: 2, text: 'scripts/gen-fixtures.ts'},
  {at: 5, kind: 'tool', tool: 'Bash', dur: 4, state: 'waits', text: 'gen-fixtures --widgets handoff · no output'},
  {at: 9, kind: 'stall', text: 'Waits for an answer: overwrite fixtures/handoff.json (y/N)'},
]
const SESS = [{id: 'lead', name: 'lead · O-I widgets'}, {id: 'tests', name: 'tests · widget suite'}, {id: 'docs', name: 'docs · manual'}]

export const clip: DesignedClip = {
  id: 'clip:factory',
  mode: 'factory',
  title: 'A Factory task',
  head: {name: 'name', colour: 'colour', active: 'active'},
  defaults: {
    name: 'Write the hand-off fixtures', colour: 'var(--fizz)', active: true, state: 'running', 'turns.used': 5, 'turns.cap': 12,
    'style.register': 'plain', 'style.form': 'technical', launch: 'once', then: 'handoff', handoff: 'tests', quantize: 'global',
    log: JSON.stringify(LOG), elapsed: 68, sessions: JSON.stringify(SESS), fold: true, event: 'e29-7',
    'env.control': 'effort', 'env.mode': 'automation', 'env.linked': true,
    'env.agent.effort': JSON.stringify([[0, 2], [28, 3], [40, 1], [60, 3]]), 'env.agent.autonomy': JSON.stringify([[0, 2], [50, 3]]),
    'view.panel': 'launch', 'view.editor': 'log',
  },
  fixtures: {
    'A running task': {},
    'A stalled task': {name: 'Generate the fixtures', colour: 'var(--stall)', state: 'stalled', 'turns.used': 2, log: JSON.stringify(STALLED), elapsed: 9, then: 'next', handoff: undefined, event: 'e5-2', 'view.panel': 'clip'},
    'Its envelopes': {'view.editor': 'envelopes', 'env.mode': 'modulation', 'env.agent.effort': JSON.stringify([[0, 2], [30, 3], [45, 1]])},
    'No readings': {state: undefined, 'turns.used': undefined, 'turns.cap': undefined, log: undefined, elapsed: undefined, sessions: undefined, launch: undefined, then: undefined, quantize: undefined},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'The task\'s name, colour, state, turns and output style.', draw: ClipPanel},
    {id: 'launch', label: 'Launch', does: 'How the task launches, when the launch lands, and what follows it.', draw: LaunchPanel},
  ],
  tools: [],
  editor: [
    {id: 'log', label: 'Log', does: 'Each tool the agent used along the task\'s time, your steers, and where the output stopped.', draw: Log, bar: logBar},
    {id: 'envelopes', label: 'Envelopes', does: 'The Agent\'s Effort and Autonomy for this task only.', draw: Envelopes},
  ],
  corner,
}
