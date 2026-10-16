// Context & world (manual §18.14, central:context-world): what an agent may read and where it may write, shown as the ground around
// the open object. Live's nearest: EQ Eight — a scale with points on it and one handle that widens the band; here the scale is rings.
// The owners are split, as the family declares (inhabitants/centralFamilyManifest.ts: a shared face). Reads: the places a world makes
// available to an agent are its sources, each with `agent_retrieval_allowed` (Central ctrl source_horizon.rs:129, retrieval_allowed :375),
// bounded by the worlds an AgentProfile ratifies (agent_profile.rs:317 ratified_world_refs; :321 knowledge_source_refs; :327
// placement_intent_refs) and resolved with ancestry and exclusions by `central.world.effective-sources`; the person's include and exclude
// is `central.world-relations.save`. Writes: `central.files.write` and `projectcentral.source.create` carry actor, actor_kind and
// agent_session_ref, and the owner records each as a source change with before and after revisions (source_horizon.rs:120-140) — that is
// the receipt, read by `projectcentral.change.horizon`. A proposal is `projectcentral.source.return`, kept until a person accepts it
// (`return_accept`, `return_reject`, `returns`). The shell's arm (agent/AgentShellContext.tsx:125, shell.setWriteArm) moves the pair
// Propose and Write. The shell reads the scope as a reading only (agentParamAddresses.ts:93-94; central/devices/centralDeviceModel.ts:166)
// because the chain holds no session. Reach, Writes to and Knowledge search have no enforcing operation yet; the manual specifies them.
// The picture is the ground by its own law: containment. Object lies inside Scene, inside Expression, inside Central, so the rings are
// nested and a place sits on the ring of the level that holds it. A place outside the Reach is drawn hollow: closed, even when asked for.
// The readings are the Packet's own: the Factory flow flow-2026-10-03-1432 in Control/user/flows, and the agent Cairn of Control/self/agents.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Scale} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__context-world.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Mode = 'off' | 'propose' | 'write'

const LEVELS = ['Object', 'Scene', 'Expression', 'Central'] as const
const TAGS = ['obj', 'scene', 'expr', 'world'] as const
const REACH: Scale = {min: 0, max: 3, step: 1}
const MODES: readonly Option<Mode>[] = [
  {value: 'off', label: 'Off', does: 'The agent does not write outside the open document.'},
  {value: 'propose', label: 'Propose', does: 'Each change waits for your approval, as a proposal.'},
  {value: 'write', label: 'Write', does: 'Each change goes in directly, with a receipt.'},
]
const FLOW = 'flow-2026-10-03-1432'

// ---------------------------------------------------------------- the ground: places, on the ring that holds them

interface Place {readonly id: string; readonly name: string; readonly path: string; readonly level: 0 | 1 | 2 | 3; readonly at: number}
/** The places an agent may read. `at` is the angle on its ring, over the top (teal side). */
const READS: readonly Place[] = [
  {id: 'doc', name: 'Open document', path: `Control/user/flows/${FLOW}.html`, level: 0, at: -150},
  {id: 'packet', name: 'Packet', path: 'The prepared context: the 3 items that you captured.', level: 0, at: -60},
  {id: 'flows', name: 'Flows', path: 'Control/user/flows', level: 1, at: -150},
  {id: 'factory', name: 'Factory', path: 'Work/Factory', level: 2, at: -35},
  {id: 'wiki', name: 'Wiki', path: 'Control/agents/wiki', level: 3, at: -118},
]
/** The places an agent may write, under the amber side. The open document is not here: the Answer device governs it. */
const WRITES: readonly Place[] = [
  {id: 'flows', name: 'Flows', path: 'Control/user/flows', level: 1, at: 140},
  {id: 'now', name: 'Factory · now', path: 'Work/Factory/ProjectCentral/now', level: 2, at: 60},
]

interface Receipt {readonly id: string; readonly agent: string; readonly at: string; readonly place: string; readonly kind: 'Added' | 'Modified'; readonly revs: string}
/** Newest first. The owner records each write as a source change: the agent, the time, the place and the revisions. */
const RECEIPTS: readonly Receipt[] = [
  {id: 'r1', agent: 'Cairn', at: '21:58', place: 'now', kind: 'Modified', revs: 'a4f1 → 9c20'},
  {id: 'r2', agent: 'Cairn', at: '21:52', place: 'now', kind: 'Added', revs: 'new'},
  {id: 'r3', agent: 'Cairn', at: '20:54', place: 'flows', kind: 'Modified', revs: '5be2 → d17a'},
]
const placeOf = (id: string) => WRITES.find(w => w.id === id)

// ---------------------------------------------------------------- what the agent can touch, from the values

const reachOf = (v: V) => num(v, 'reach')
const modeOf = (v: V) => str(v, 'writes') as Mode
const inReach = (v: V, level: number) => level <= reachOf(v)
const asked = (v: V, key: string) => on(v, key)
/** Places the agent reads: asked for, and inside the Reach. */
const readsLit = (v: V) => READS.filter(p => asked(v, `r:${p.id}`) && inReach(v, p.level))
/** Places the agent writes: asked for, inside the Reach, and Writes elsewhere is not Off. */
const writesLit = (v: V) => (modeOf(v) === 'off' ? [] : WRITES.filter(p => asked(v, `w:${p.id}`) && inReach(v, p.level)))
const writeRing = (v: V) => writesLit(v).reduce((top, p) => Math.max(top, p.level), -1)
const receiptsOf = (v: V) => RECEIPTS.slice(0, Math.max(0, Math.min(RECEIPTS.length, num(v, 'receipts'))))
const countFor = (v: V, place: string) => receiptsOf(v).filter(r => r.place === place).length
const modeWord = (v: V) => MODES.find(m => m.value === modeOf(v))!.label

const askReachIn = (v: V, set: SetFn) => (x: number) => (x > reachOf(v) ? set('reachPending', x) : (set('reach', x), set('reachPending', undefined)))
const askReach = (p: ViewProps) => askReachIn(p.v, p.set)

function readRows(v: V): RowItem[] {
  return READS.map(p => {
    const request = asked(v, `r:${p.id}`), open = request && inReach(v, p.level)
    return {id: p.id, name: p.name, request, light: open ? 'lit' : 'dark', tone: 'value', note: TAGS[p.level],
      why: request && !open ? 'Outside the Reach. The place stays closed.' : undefined, does: p.path}
  })
}
function writeRows(v: V): RowItem[] {
  return WRITES.map(p => {
    const request = asked(v, `w:${p.id}`), outside = !inReach(v, p.level), off = modeOf(v) === 'off'
    return {id: p.id, name: p.name, request, light: request && !outside && !off ? 'lit' : 'dark', tone: 'accent', note: `${countFor(v, p.id)}`,
      why: request && outside ? 'Outside the Reach. The place stays closed.' : request && off ? 'Writes elsewhere is Off.' : undefined, does: p.path}
  })
}
function receiptRows(v: V): RowItem[] {
  const rows = receiptsOf(v)
  if (!rows.length) return [{id: 'none', name: 'No receipts', light: 'unknown'}]
  return rows.map(r => ({id: r.id, name: placeOf(r.place)!.name, light: 'lit', tone: 'accent', note: r.at,
    does: `${r.agent} ${r.kind === 'Added' ? 'added' : 'changed'} ${placeOf(r.place)!.path} at ${r.at}. ${r.revs}.`}))
}

// ---------------------------------------------------------------- the display: the rings, and the places on them

/** The rings: the open object at the centre, then Scene, Expression and Central. The teal arc over the top is the Reach, the amber arc
 * under the bottom is the writes: dashed while a change waits (Propose), solid when it lands (Write). Handle 1 sets the Reach. */
function Rings({v, set, w, h, labels, tile}: {v: V; set?: SetFn; w: number; h: number; labels?: boolean; tile?: boolean}) {
  const maxR = Math.min(w, h) / 2 - (tile ? 4 : 8), r0 = tile ? 7 : 12, step = (maxR - r0) / 3
  const cx = w / 2, cy = h / 2 + (labels ? 3 : 0)
  const R = (i: number) => (i <= 0 ? r0 : r0 + i * step)
  const rad = (deg: number) => deg * Math.PI / 180
  const at = (i: number, deg: number) => [cx + R(i) * Math.cos(rad(deg)), cy + R(i) * Math.sin(rad(deg))] as const
  const reach = reachOf(v), pending = v.reachPending === undefined ? null : Number(v.reachPending), shown = pending ?? reach
  const mode = modeOf(v), wr = writeRing(v), size = tile ? 2.4 : 3.4
  const [hx, hy] = at(shown, 0)
  return <g>
    <circle cx={cx} cy={cy} r={R(reach)} fill="rgba(92,200,189,.10)" />
    {wr >= 0 && <circle cx={cx} cy={cy} r={R(wr)} fill="rgba(255,190,0,.12)" />}
    {LEVELS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={R(i)} className="dp-faint" />
      {labels && i > 0 && <text x={cx} y={cy - R(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    <path d={`M${cx - R(reach)} ${cy}A${R(reach)} ${R(reach)} 0 0 1 ${cx + R(reach)} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />
    {wr >= 0 && <path d={`M${cx + R(wr)} ${cy}A${R(wr)} ${R(wr)} 0 0 1 ${cx - R(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2}
      strokeDasharray={mode === 'propose' ? '4 3' : undefined} />}
    {pending !== null && <circle cx={cx} cy={cy} r={R(pending)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {READS.map(p => {
      const [x, y] = at(p.level, p.at), want = asked(v, `r:${p.id}`), open = want && inReach(v, p.level)
      return want
        ? <circle key={p.id} cx={x} cy={y} r={size} fill={open ? 'var(--dp-value)' : 'var(--bg-0, #26292d)'} stroke="var(--dp-value)" strokeWidth={1.2}
          strokeDasharray={open ? undefined : '2 1.5'} opacity={open ? 1 : .75} />
        : <circle key={p.id} cx={x} cy={y} r={1.6} fill="var(--text-faint)" opacity={.6} />
    })}
    {WRITES.map(p => {
      const [x, y] = at(p.level, p.at), want = asked(v, `w:${p.id}`), open = want && inReach(v, p.level) && mode !== 'off'
      return want
        ? <rect key={p.id} x={x - size} y={y - size} width={size * 2} height={size * 2} fill={open ? 'var(--dp-on)' : 'var(--bg-0, #26292d)'}
          fillOpacity={open && mode === 'propose' ? .4 : 1} stroke="var(--dp-on)" strokeWidth={1.2} strokeDasharray={open && mode === 'write' ? undefined : '2 1.5'} opacity={open ? 1 : .75} />
        : <rect key={p.id} x={x - 1.6} y={y - 1.6} width={3.2} height={3.2} fill="var(--text-faint)" opacity={.6} />
    })}
    {!tile && <g>
      <circle cx={9} cy={h - 8} r={3} fill={on(v, 'knowledge') ? 'var(--dp-value)' : 'none'} stroke={on(v, 'knowledge') ? 'var(--dp-value)' : 'var(--text-faint)'} strokeWidth={1.1} />
      <text x={15} y={h - 5} className="dp-axis">search</text>
    </g>}
    {set && !tile && <Handle n={1} x={hx} y={hy} label="Reach" shape="ring" tone="value"
      does="Drag out or in: the widest area the agent can read from. A raise waits for Confirm."
      onDrag={(x, y) => askReachIn(v, set)(Math.round(clampTo(0, 3, (Math.hypot(x - cx, y - cy) - r0) / step)))}
      onReset={() => { set('reach', 0); set('reachPending', undefined) }} />}
  </g>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})
const cornerOf = (v: V) => `reach ${LEVELS[v.reachPending === undefined ? reachOf(v) : Number(v.reachPending)]!.toLowerCase()}`
const PICTURE = 'Teal: the places the agent reads. Amber: the places it writes. A hollow mark is closed. Drag handle 1 to set the Reach.'

const ReachDial = ({p}: {p: ViewProps}) =>
  <Dial label="Reach" does="The widest area the agent can read from: Object, Scene, Expression or Central. A raise waits for Confirm in the pool."
    value={reachOf(p.v)} def={0} scale={REACH} format={x => LEVELS[x]!} onChange={askReach(p)} pending={p.v.reachPending !== undefined} />
const WritesRadio = ({p, label}: {p: ViewProps; label?: string}) =>
  <Radio label={label} does="Writes elsewhere: how a write arrives at any place except the open document. The Answer device sets that one." value={modeOf(p.v)} options={MODES} stack
    onChange={x => p.set('writes', x)} />
const SearchToggle = ({p}: {p: ViewProps}) =>
  <Toggle label="Knowledge" does="Knowledge search: lets the agent search your knowledge for passages." on={on(p.v, 'knowledge')} onChange={x => p.set('knowledge', x)} />

/** The consent pair under a raised Reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  if (p.v.reachPending === undefined) return null
  const to = Number(p.v.reachPending)
  return <>
    <Action label="Confirm" does={`Raise the Reach to ${LEVELS[to]}. The agent may then read that far.`} onPress={() => { p.set('reach', to); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the Reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </>
}

// ---------------------------------------------------------------- the pane: the ground as a tree

interface Node {readonly id: string; readonly name: string; readonly depth: number; readonly level: 0 | 1 | 2 | 3; readonly read?: string; readonly write?: string; readonly tag?: string}
const TREE: readonly Node[] = [
  {id: 'packet', name: 'Packet · 3 items', depth: 0, level: 0, read: 'packet', tag: 'prepared'},
  {id: 'root', name: 'Central', depth: 0, level: 3},
  {id: 'flows', name: 'Control/user/flows', depth: 1, level: 1, read: 'flows', write: 'flows', tag: 'scene'},
  {id: 'doc', name: FLOW, depth: 2, level: 0, read: 'doc', write: 'answer', tag: 'object · open'},
  {id: 'wiki', name: 'Control/agents/wiki', depth: 1, level: 3, read: 'wiki', tag: 'central'},
  {id: 'factory', name: 'Work/Factory', depth: 1, level: 2, read: 'factory', tag: 'expression'},
  {id: 'now', name: 'ProjectCentral/now', depth: 2, level: 2, write: 'now', tag: 'expression'},
]
const WORD: Record<string, string> = {reads: 'reads', closed: 'closed', proposes: 'proposes', writes: 'writes', off: 'off'}

function readState(v: V, node: Node): string {
  if (!node.read || !asked(v, `r:${node.read}`)) return 'none'
  return inReach(v, node.level) ? 'reads' : 'closed'
}
function writeState(v: V, node: Node): string {
  if (!node.write || node.write === 'answer' || !asked(v, `w:${node.write}`)) return 'none'
  if (!inReach(v, node.level)) return 'closed'
  return modeOf(v) === 'off' ? 'off' : modeOf(v) === 'propose' ? 'proposes' : 'writes'
}
const Mark = ({kind, state}: {kind: 'read' | 'write'; state: string}) => state === 'none'
  ? <span className="ccw-none" aria-hidden="true">·</span>
  : <span className="ccw-mark" data-kind={kind} data-state={state}><i />{WORD[state]}</span>

function Pane({p}: {p: ViewProps}) {
  const v = p.v, reach = reachOf(v), rows = receiptsOf(v), waiting = num(v, 'waiting')
  return <div className="ref-pane-body ccw-pane">
    <div className="ref-pane-tabs" role="tablist" aria-label="Context and world">
      <button type="button" role="tab" aria-selected="true">Ground · {LEVELS[reach]}</button>
    </div>
    <div className="ccw-sheet">
      <header className="ccw-head">
        <h3>Context &amp; world <small>{FLOW}</small></h3>
        <p>Your ground, as this agent may touch it. A place beyond the Reach is closed, even when you asked for it.</p>
      </header>
      <ul className="ccw-tree">
        <li className="ccw-node ccw-cols" aria-hidden="true"><span>Place</span><span>Level</span><span>Reads</span><span>Writes</span></li>
        {TREE.map(node => {
          const open = node.level <= reach
          return <li key={node.id} className="ccw-node" data-in={open ? 'true' : 'false'} data-i={`${node.name}|${node.tag ? `Level: ${node.tag}.` : 'A folder on the way.'}`}>
            <span className="ccw-name" style={{paddingLeft: node.depth * 16}}>{node.name}</span>
            <span className="ccw-tag">{node.tag ?? ''}</span>
            <Mark kind="read" state={readState(v, node)} />
            {node.write === 'answer'
              ? <span className="ccw-answer" data-i="Answer|The open document follows Agent writes of the Answer device. Context & world governs every other place.">Answer sets</span>
              : <Mark kind="write" state={writeState(v, node)} />}
          </li>
        })}
      </ul>
      <section className="ccw-receipts" aria-label="Receipts">
        <h4>Receipts</h4>
        {rows.length === 0
          ? <p className="ccw-empty">No receipts. The agent has written nothing outside the open document.</p>
          : <ol>{rows.map(r => <li key={r.id} data-i={`Receipt|${r.agent} ${r.kind === 'Added' ? 'added' : 'changed'} ${placeOf(r.place)!.path}. ${r.revs}.`}>
            <b>{r.agent}</b><span>{r.at}</span><span>{placeOf(r.place)!.path}</span><span>{r.kind === 'Added' ? 'added' : 'changed'} · {r.revs}</span>
          </li>)}</ol>}
      </section>
      <footer className="ccw-foot">
        <span><b>{readsLit(v).length}</b> places read</span>
        <span><b>{writesLit(v).length}</b> places written</span>
        <span>Writes elsewhere <b>{modeWord(v)}</b></span>
        <span>Knowledge search <b>{on(v, 'knowledge') ? 'On' : 'Off'}</b></span>
        <span><b>{waiting}</b> {waiting === 1 ? 'proposal waits' : 'proposals wait'}</span>
      </footer>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:context-world',
  title: 'Context & world',
  kind: 'effect',
  defaults: {
    light: 'lit', reach: 0, writes: 'propose', knowledge: false,
    // Your requests: the open document and the packet are read; no place is written.
    'r:doc': true, 'r:packet': true, 'r:flows': false, 'r:factory': false, 'r:wiki': false, 'w:flows': false, 'w:now': false,
    // Readings from the owner: the receipts of the agent's writes, and the proposals that wait.
    receipts: 0, waiting: 0, readsPage: 0, writesPage: 0,
  },
  fixtures: {
    'Open document': {},
    'Writes landed': {reach: 2, writes: 'write', knowledge: true, 'r:flows': true, 'r:factory': true, 'w:flows': true, 'w:now': true, receipts: 3},
    'Outside the Reach': {reach: 1, 'r:flows': true, 'r:factory': true, 'r:wiki': true, 'w:now': true, waiting: 2},
  },

  folded: p => <Folded title="Context & world" light={light(p.v)} readings={[LEVELS[reachOf(p.v)]!, `${readsLit(p.v).length}r ${writesLit(p.v).length}w`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Context & world" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Reach and places" does={PICTURE} corner={cornerOf(p.v)}>
        <Rings v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <ReachDial p={p} />
      <WritesRadio p={p} label="Writes" />
      <SearchToggle p={p} />
      <Readout label="receipts" does="Receipts of the agent's writes. Press to open the places in a pane." value={receiptsOf(p.v).length} tone="accent" onPress={p.nav.full} />
    </Section>
  </Panel>,

  whole: p => {
    const [readPage, writePage] = [num(p.v, 'readsPage'), num(p.v, 'writesPage')]
    return <Panel title="Context & world" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Reach and places" does={PICTURE} corner={cornerOf(p.v)}>
            <Rings v={p.v} set={p.set} w={194} h={146} labels />
          </Display>
        </Section>
        <Section label="Reach" width={80}>
          <Radio does="The widest area the agent can read from. A raise waits for Confirm." value={String(p.v.reachPending ?? reachOf(p.v))} stack
            options={LEVELS.map((name, i) => ({value: String(i), label: name}))} onChange={x => askReach(p)(Number(x))} pending={p.v.reachPending !== undefined} />
          <Consent p={p} />
        </Section>
        <Section grow>
          <WritesRadio p={p} label="Writes elsewhere" />
          <Readout label="waiting" does="Proposals that wait for your approval." value={num(p.v, 'waiting')} tone={num(p.v, 'waiting') ? 'stall' : undefined} />
        </Section>
      </Band>
      <Band>
        <Section width={148}>
          <Rows label="Reads" does="The places the agent may read. The square is your request; teal marks a place inside the Reach." items={readRows(p.v)} size={5}
            page={readPage} onPage={n => p.set('readsPage', n)} onRequest={(id, now) => p.set(`r:${id}`, now)} />
          <SearchToggle p={p} />
        </Section>
        <Section width={124}>
          <Rows label="Writes to" does="The places the agent may write. The square is your request; amber marks a place inside the Reach. The note counts receipts." items={writeRows(p.v)} size={5}
            page={writePage} onPage={n => p.set('writesPage', n)} onRequest={(id, now) => p.set(`w:${id}`, now)} />
        </Section>
        <Section grow>
          <Rows label="Receipts" does="The latest writes of the agent: the place and the time. Newest first." items={receiptRows(p.v)} size={5} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const last = receiptsOf(p.v)[0], reads = readsLit(p.v).length, writes = writesLit(p.v).length
    return <Tile title="Context & world" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Display w={104} h={104} label="Reach and places" does="The rings, the Reach and the places that the agent reads and writes. Press the receipt to open them.">
        <Rings v={p.v} w={104} h={104} tile />
      </Display>
      <div className="ref-tile-side">
        <Readout label="reach" does="The widest area the agent can read from." value={LEVELS[reachOf(p.v)]} tone="value" />
        <Readout label="read · write" does="Places that the agent reads, and places that it writes." value={`${reads} · ${writes}`} />
        <Readout label="last receipt" does="The time of the agent's last write. Press to open the places in a pane." value={last ? last.at : 'none'} tone="accent" onPress={last ? p.nav.full : undefined} />
      </div>
    </Tile>
  },
}
