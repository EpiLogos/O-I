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
// The sample readings are the Packet's own: the Factory flow flow-2026-10-03-1432 in Control/user/flows, and the agent Cairn of Control/self/agents.
//
// Values. Readings the owner reports (Scope's keys and shapes for the places):
//   reach 0..3          the widest ring the agent reads     reads, writes   JSON lists of {id, name, ring, receipts?, path?, at?}
//   writeMode           off | propose | write               knowledge       the knowledge search, on or off
//   receipts            JSON list of source changes {id, actor, at, place, before, after, kind?}, newest first
//   waiting             the proposals that wait (a count, or a JSON list of them)      light   lit or dark
//   tree, document      the pane's ground as a tree (JSON, optional: the pane draws the places when it is absent), the open document
// Held by the hand (no reading): r:<id> and w:<id> (a place you request; requested unless false), reachPending, readsPage, writesPage.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, clock, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__context-world.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Mode = 'off' | 'propose' | 'write'
type Ring = 0 | 1 | 2 | 3

const LEVELS = ['Object', 'Scene', 'Expression', 'Central'] as const
const TAGS = ['obj', 'scene', 'expr', 'world'] as const
const KINDS = ['object', 'scene', 'expression', 'central'] as const
const REACH: Scale = {min: 0, max: 3, step: 1}
const MODES: readonly Option<Mode>[] = [
  {value: 'off', label: 'Off', does: 'The agent does not write outside the open document.'},
  {value: 'propose', label: 'Propose', does: 'Each change waits for your approval, as a proposal.'},
  {value: 'write', label: 'Write', does: 'Each change goes in directly, with a receipt.'},
]

// ---------------------------------------------------------------- reading the values (every list is the owner's; nothing is assumed)

const obj = (x: unknown): Record<string, unknown> | undefined => (x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const ringIn = (x: unknown): Ring | undefined => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3 ? x as Ring : undefined)
/** A JSON list the owner reported: undefined when absent or unreadable. An empty list is a reading: nothing there. */
const listOf = (v: V, key: string): Record<string, unknown>[] | undefined => {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.flatMap(x => { const o = obj(x); return o ? [o] : [] }) : undefined
}
/** A time as drawn: the owner's own text, or a clock time from a number (unix seconds or milliseconds). */
const timeOf = (x: unknown): string | undefined => {
  if (text(x)) return text(x)
  const n = count(x)
  if (n === undefined) return undefined
  const d = new Date(n > 1e11 ? n : n * 1000)
  return Number.isNaN(d.getTime()) ? undefined : clock(d.getHours() * 60 + d.getMinutes())
}

/** A place the agent may read or write, on the ring that holds it (0 object … 3 Central). `path` says what it is; `at` is its angle. */
interface Place {readonly id: string; readonly name: string; readonly ring?: Ring; readonly path?: string; readonly at?: number; readonly receipts?: number}
const placesOf = (v: V, key: string): Place[] | undefined => listOf(v, key)?.flatMap(o => {
  const id = text(o.id)
  return id ? [{id, name: text(o.name) ?? id, ring: ringIn(o.ring), path: text(o.path), at: count(o.at), receipts: count(o.receipts)}] : []
}).filter((p, i, all) => all.findIndex(q => q.id === p.id) === i)
const reads = (v: V) => placesOf(v, 'reads')
const writes = (v: V) => placesOf(v, 'writes')

/** The angle of a place on its ring: its own, or an even spread of the ring's places over the top (reads) or under the bottom (writes). */
function angleOf(list: readonly Place[], p: Place, over: boolean): number {
  if (p.at !== undefined) return p.at
  const same = list.filter(q => q.ring === p.ring), t = (same.indexOf(p) + 1) / (same.length + 1)
  return over ? -170 + t * 160 : 10 + t * 160
}

/** One source change the owner recorded for a write: who, when, where, and the revisions either side. */
interface Receipt {readonly id: string; readonly actor?: string; readonly at?: string; readonly place?: string; readonly kind?: 'added' | 'changed' | 'removed'; readonly before?: string; readonly after?: string}
const receiptsOf = (v: V): Receipt[] | undefined => listOf(v, 'receipts')?.map((o, i) => {
  const before = text(o.before), after = text(o.after), said = text(o.kind)?.toLowerCase()
  const kind = said === 'added' ? 'added' : said === 'removed' ? 'removed' : said === 'modified' || said === 'changed' ? 'changed'
    : before && after ? 'changed' : after ? 'added' : before ? 'removed' : undefined
  return {id: text(o.id) ?? `receipt-${i}`, actor: text(o.actor), at: timeOf(o.at), place: text(o.place), kind, before, after}
})
const placeFor = (v: V, r: Receipt) => (r.place === undefined ? undefined : writes(v)?.find(p => p.id === r.place || p.path === r.place))
const verbOf = (r: Receipt) => r.kind === 'added' ? 'added' : r.kind === 'removed' ? 'removed' : r.kind === 'changed' ? 'changed' : 'wrote'
const revsOf = (r: Receipt) => r.before && r.after ? `${r.before} → ${r.after}` : r.after || r.kind === 'added' ? 'new' : r.before ? `${r.before} → gone` : undefined
const receiptSaid = (v: V, r: Receipt) => `${r.actor ?? NONE} ${verbOf(r)} ${placeFor(v, r)?.path ?? r.place ?? NONE} at ${r.at ?? NONE}. ${revsOf(r) ?? NONE}.`
/** The receipts for one place, as the owner counts them on the place or as the receipts name it; undefined when neither reports. */
const receiptsFor = (v: V, p: Place) => p.receipts ?? receiptsOf(v)?.filter(r => r.place === p.id || (p.path !== undefined && r.place === p.path)).length

/** The proposals that wait: a count, or a list of them; undefined when the owner reports neither. */
function waitingOf(v: V): number | undefined {
  if (!has(v, 'waiting')) return undefined
  if (typeof v.waiting === 'number') return v.waiting
  const list = json<unknown>(v, 'waiting', undefined)
  if (Array.isArray(list)) return list.length
  const n = String(v.waiting).trim() === '' ? NaN : Number(v.waiting)
  return Number.isFinite(n) ? n : undefined
}

// ---------------------------------------------------------------- what the agent can touch, from the values

const reach = (v: V): Ring | undefined => ringIn(numOf(v, 'reach'))
const pending = (v: V): Ring | undefined => ringIn(numOf(v, 'reachPending'))
const modeOf = (v: V): Mode | undefined => MODES.find(m => m.value === strOf(v, 'writeMode'))?.value
const asked = (v: V, key: string) => v[key] !== false
const reachName = (v: V) => { const r = reach(v); return r === undefined ? undefined : LEVELS[r] }
/** Whether a ring is inside the Reach: undefined while the Reach is not reported (or the ring unknown). */
const inReach = (v: V, ring: Ring | undefined) => { const r = reach(v); return r === undefined || ring === undefined ? undefined : ring <= r }
/** Places the agent reads: asked for, and inside the Reach. Undefined when the places or the Reach are not reported. */
const readsLit = (v: V) => reads(v)?.filter(p => asked(v, `r:${p.id}`) && inReach(v, p.ring) === true)
/** Places the agent writes: asked for, inside the Reach, and Writes elsewhere is not Off. */
const writesLit = (v: V) => { const m = modeOf(v); return m === undefined ? undefined : m === 'off' ? (writes(v) ? [] : undefined) : writes(v)?.filter(p => asked(v, `w:${p.id}`) && inReach(v, p.ring) === true) }
const writeRing = (v: V) => (writesLit(v) ?? []).reduce((top, p) => Math.max(top, p.ring ?? 0), -1)

/** A reach you set: a raise, or any reach while the owner has not reported one, waits for Confirm; a narrowing goes at once. */
const askReachIn = (v: V, set: SetFn) => (x: number) => {
  const now = reach(v)
  if (now === undefined || x > now) set('reachPending', x)
  else { set('reach', x); set('reachPending', undefined) }
}
const askReach = (p: ViewProps) => askReachIn(p.v, p.set)

const NO_PLACES: RowItem[] = [{id: 'none', name: 'No reading', light: 'unknown'}]
function readRows(v: V): RowItem[] {
  const list = reads(v)
  if (!list) return NO_PLACES
  if (!list.length) return [{id: 'none', name: 'No places', light: 'unknown'}]
  return list.map(p => {
    const request = asked(v, `r:${p.id}`), open = inReach(v, p.ring)
    return {id: p.id, name: p.name, request, light: open === undefined ? 'unknown' : request && open ? 'lit' : 'dark', tone: 'value', note: p.ring === undefined ? NONE : TAGS[p.ring],
      why: request && open === false ? 'Outside the Reach. The place stays closed.' : undefined, does: p.path}
  })
}
function writeRows(v: V): RowItem[] {
  const list = writes(v), m = modeOf(v)
  if (!list) return NO_PLACES
  if (!list.length) return [{id: 'none', name: 'No places', light: 'unknown'}]
  return list.map(p => {
    const request = asked(v, `w:${p.id}`), open = inReach(v, p.ring), n = receiptsFor(v, p)
    return {id: p.id, name: p.name, request, light: open === undefined || m === undefined ? 'unknown' : request && open && m !== 'off' ? 'lit' : 'dark', tone: 'accent',
      note: n === undefined ? NONE : `${n}`,
      why: request && open === false ? 'Outside the Reach. The place stays closed.' : request && m === 'off' ? 'Writes elsewhere is Off.' : undefined, does: p.path}
  })
}
function receiptRows(v: V): RowItem[] {
  const rows = receiptsOf(v)
  if (!rows) return NO_PLACES
  if (!rows.length) return [{id: 'none', name: 'No receipts', light: 'unknown'}]
  return rows.map(r => ({id: r.id, name: placeFor(v, r)?.name ?? r.place ?? NONE, light: 'lit', tone: 'accent', note: r.at, does: receiptSaid(v, r)}))
}

// ---------------------------------------------------------------- the display: the rings, and the places on them

/** The rings: the open object at the centre, then Scene, Expression and Central. The teal arc over the top is the Reach, the amber arc
 * under the bottom is the writes: dashed while a change waits (Propose), solid when it lands (Write). Handle 1 sets the Reach. With no
 * reading of the Reach the rings stand bare and say so. */
function Rings({v, set, w, h, labels, tile}: {v: V; set?: SetFn; w: number; h: number; labels?: boolean; tile?: boolean}) {
  const maxR = Math.min(w, h) / 2 - (tile ? 4 : 8), r0 = tile ? 7 : 12, step = (maxR - r0) / 3
  const cx = w / 2, cy = h / 2 + (labels ? 3 : 0)
  const R = (i: number) => (i <= 0 ? r0 : r0 + i * step)
  const rad = (deg: number) => deg * Math.PI / 180
  const at = (i: number, deg: number) => [cx + R(i) * Math.cos(rad(deg)), cy + R(i) * Math.sin(rad(deg))] as const
  const now = reach(v), wait = pending(v), shownReach = wait ?? now ?? 0
  const mode = modeOf(v), wr = writeRing(v), size = tile ? 2.4 : 3.4
  const rl = reads(v) ?? [], wl = writes(v) ?? [], search = boolOf(v, 'knowledge')
  const [hx, hy] = at(shownReach, 0)
  return <g>
    {now !== undefined && <circle cx={cx} cy={cy} r={R(now)} fill="rgba(92,200,189,.10)" />}
    {wr >= 0 && <circle cx={cx} cy={cy} r={R(wr)} fill="rgba(255,190,0,.12)" />}
    {LEVELS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={R(i)} className="dp-faint" />
      {labels && i > 0 && <text x={cx} y={cy - R(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    {now !== undefined && <path d={`M${cx - R(now)} ${cy}A${R(now)} ${R(now)} 0 0 1 ${cx + R(now)} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />}
    {wr >= 0 && <path d={`M${cx + R(wr)} ${cy}A${R(wr)} ${R(wr)} 0 0 1 ${cx - R(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2}
      strokeDasharray={mode === 'propose' ? '4 3' : undefined} />}
    {wait !== undefined && <circle cx={cx} cy={cy} r={R(wait)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {rl.map(p => {
      if (p.ring === undefined) return null
      const [x, y] = at(p.ring, angleOf(rl, p, true)), want = asked(v, `r:${p.id}`), open = inReach(v, p.ring)
      return want && open !== undefined
        ? <circle key={p.id} cx={x} cy={y} r={size} fill={open ? 'var(--dp-value)' : 'var(--bg-0, #26292d)'} stroke="var(--dp-value)" strokeWidth={1.2}
          strokeDasharray={open ? undefined : '2 1.5'} opacity={open ? 1 : .75} />
        : <circle key={p.id} cx={x} cy={y} r={1.6} fill="var(--text-faint)" opacity={.6} />
    })}
    {wl.map(p => {
      if (p.ring === undefined) return null
      const [x, y] = at(p.ring, angleOf(wl, p, false)), want = asked(v, `w:${p.id}`), inside = inReach(v, p.ring), open = inside === true && mode !== undefined && mode !== 'off'
      return want && inside !== undefined && mode !== undefined
        ? <rect key={p.id} x={x - size} y={y - size} width={size * 2} height={size * 2} fill={open ? 'var(--dp-on)' : 'var(--bg-0, #26292d)'}
          fillOpacity={open && mode === 'propose' ? .4 : 1} stroke="var(--dp-on)" strokeWidth={1.2} strokeDasharray={open && mode === 'write' ? undefined : '2 1.5'} opacity={open ? 1 : .75} />
        : <rect key={p.id} x={x - 1.6} y={y - 1.6} width={3.2} height={3.2} fill="var(--text-faint)" opacity={.6} />
    })}
    {now === undefined && wait === undefined && !tile && w > 90 && <text x={6} y={12} className="dp-ink-dim" style={{paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>No reading of the reach</text>}
    {!tile && <g>
      <circle cx={9} cy={h - 8} r={3} fill={search === true ? 'var(--dp-value)' : 'none'} stroke={search === true ? 'var(--dp-value)' : 'var(--text-faint)'} strokeWidth={1.1}
        strokeDasharray={search === undefined ? '1.5 1.5' : undefined} />
      <text x={15} y={h - 5} className="dp-axis">{search === undefined ? `search ${NONE}` : 'search'}</text>
    </g>}
    {set && !tile && <Handle n={1} x={hx} y={hy} label="Reach" shape="ring" tone="value"
      does="Drag out or in: the widest area the agent can read from. A raise waits for Confirm."
      onDrag={(x, y) => askReachIn(v, set)(Math.round(clampTo(0, 3, (Math.hypot(x - cx, y - cy) - r0) / step)))}
      onReset={() => { set('reach', 0); set('reachPending', undefined) }} />}
  </g>
}

// ---------------------------------------------------------------- the controls

// The light reads the owner alone (manual §16.8): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const cornerOf = (v: V) => { const r = pending(v) ?? reach(v); return r === undefined ? NONE : `reach ${LEVELS[r]?.toLowerCase() ?? NONE}` }
const PICTURE = 'Teal: the places the agent reads. Amber: the places it writes. A hollow mark is closed. Drag handle 1 to set the Reach.'
const holds = (p: ViewProps) => pending(p.v) !== undefined || st(p, 'reach').pending

const ReachDial = ({p}: {p: ViewProps}) =>
  <Dial {...st(p, 'reach')} label="Reach" does="The widest area the agent can read from: Object, Scene, Expression or Central. A raise waits for Confirm in the pool."
    value={reach(p.v) ?? NaN} def={0} scale={REACH} format={x => LEVELS[x] ?? NONE} onChange={askReach(p)} pending={holds(p)} />
const WritesRadio = ({p, label}: {p: ViewProps; label?: string}) =>
  <Radio {...st(p, 'writeMode')} label={label} does="Writes elsewhere: how a write arrives at any place except the open document. The Answer device sets that one."
    value={modeOf(p.v) ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
const SearchToggle = ({p}: {p: ViewProps}) => {
  const now = boolOf(p.v, 'knowledge')
  return <Toggle {...st(p, 'knowledge')} label="Knowledge" does="Knowledge search: lets the agent search your knowledge for passages." on={now === true} unknown={now === undefined}
    onChange={x => p.set('knowledge', x)} />
}

/** The consent pair under a raised Reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  const to = pending(p.v)
  if (to === undefined) return null
  return <>
    <Action {...st(p, 'reach')} label="Confirm" does={`Raise the Reach to ${LEVELS[to]}. The agent may then read that far.`} onPress={() => { p.set('reach', to); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the Reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </>
}

// ---------------------------------------------------------------- the pane: the ground as a tree

/** A line of the ground: a place, or a folder on the way. `read` and `write` name the places (ids) it carries; `write: 'answer'` is the open document. */
interface Node {readonly id: string; readonly name: string; readonly depth: number; readonly ring?: Ring; readonly read?: string; readonly write?: string; readonly tag?: string}
/** The tree the owner reports, or else the places themselves, one line each (a column whose list is not reported stays unread). */
function treeOf(v: V): Node[] | undefined {
  const given = listOf(v, 'tree')
  if (given) return given.map((o, i) => ({id: text(o.id) ?? `node-${i}`, name: text(o.name) ?? NONE, depth: Math.max(0, count(o.depth) ?? 0), ring: ringIn(o.ring),
    read: text(o.read), write: text(o.write), tag: text(o.tag)}))
  const [r, w] = [reads(v), writes(v)]
  if (!r && !w) return undefined
  const ids = [...(r ?? []), ...(w ?? [])].map(p => p.id).filter((id, i, all) => all.indexOf(id) === i)
  return ids.map(id => {
    const p = r?.find(q => q.id === id) ?? w?.find(q => q.id === id)!
    return {id, name: p.path ?? p.name, depth: 0, ring: p.ring, tag: p.ring === undefined ? undefined : KINDS[p.ring],
      read: !r || r.some(q => q.id === id) ? id : undefined, write: !w || w.some(q => q.id === id) ? id : undefined}
  })
}
type State = 'none' | 'unknown' | 'reads' | 'closed' | 'proposes' | 'writes' | 'off'
const WORD: Record<string, string> = {reads: 'reads', closed: 'closed', proposes: 'proposes', writes: 'writes', off: 'off'}

function readState(v: V, node: Node): State {
  if (!node.read) return 'none'
  const list = reads(v)
  if (!list) return 'unknown'
  const place = list.find(p => p.id === node.read)
  if (!place || !asked(v, `r:${place.id}`)) return 'none'
  const open = inReach(v, node.ring ?? place.ring)
  return open === undefined ? 'unknown' : open ? 'reads' : 'closed'
}
function writeState(v: V, node: Node): State {
  if (!node.write) return 'none'
  const list = writes(v)
  if (!list) return 'unknown'
  const place = list.find(p => p.id === node.write)
  if (!place || !asked(v, `w:${place.id}`)) return 'none'
  const open = inReach(v, node.ring ?? place.ring), m = modeOf(v)
  if (open === false) return 'closed'
  if (open === undefined || m === undefined) return 'unknown'
  return m === 'off' ? 'off' : m === 'propose' ? 'proposes' : 'writes'
}
const Mark = ({kind, state}: {kind: 'read' | 'write'; state: State}) => state === 'none'
  ? <span className="ccw-none" aria-hidden="true">·</span>
  : state === 'unknown'
    ? <span className="ccw-none" data-i="No reading|The owner has not reported this.">{NONE}</span>
    : <span className="ccw-mark" data-kind={kind} data-state={state}><i />{WORD[state]}</span>

function Pane({p}: {p: ViewProps}) {
  const v = p.v, tree = treeOf(v), rows = receiptsOf(v), waiting = waitingOf(v), lit = [readsLit(v), writesLit(v)], search = boolOf(v, 'knowledge')
  return <div className="ref-pane-body ccw-pane">
    <div className="ref-pane-tabs" role="tablist" aria-label="Context and world">
      <button type="button" role="tab" aria-selected="true">Ground · {reachName(v) ?? NONE}</button>
    </div>
    <div className="ccw-sheet">
      <header className="ccw-head">
        <h3>Context &amp; world <small>{shown(v, 'document')}</small></h3>
        <p>Your ground, as this agent may touch it. A place beyond the Reach is closed, even when you asked for it.</p>
      </header>
      <ul className="ccw-tree">
        <li className="ccw-node ccw-cols" aria-hidden="true"><span>Place</span><span>Level</span><span>Reads</span><span>Writes</span></li>
        {tree === undefined && <li className="ccw-node"><span className="ccw-name">No reading of the places</span></li>}
        {tree?.length === 0 && <li className="ccw-node"><span className="ccw-name">No places</span></li>}
        {tree?.map(node => {
          const open = inReach(v, node.ring)
          return <li key={node.id} className="ccw-node" data-in={open === undefined ? undefined : open ? 'true' : 'false'}
            data-i={`${node.name}|${node.tag ? `Level: ${node.tag}.` : 'A folder on the way.'}`}>
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
        {rows === undefined
          ? <p className="ccw-empty">No reading of the receipts.</p>
          : rows.length === 0
            ? <p className="ccw-empty">No receipts. The agent has written nothing outside the open document.</p>
            : <ol>{rows.map((r, i) => <li key={`${r.id}:${i}`} data-i={`Receipt|${receiptSaid(v, r)}`}>
              <b>{r.actor ?? NONE}</b><span>{r.at ?? NONE}</span><span>{placeFor(v, r)?.path ?? r.place ?? NONE}</span><span>{verbOf(r)} · {revsOf(r) ?? NONE}</span>
            </li>)}</ol>}
      </section>
      <footer className="ccw-foot">
        <span><b>{lit[0]?.length ?? NONE}</b> places read</span>
        <span><b>{lit[1]?.length ?? NONE}</b> places written</span>
        <span>Writes elsewhere <b>{MODES.find(m => m.value === modeOf(v))?.label ?? NONE}</b></span>
        <span>Knowledge search <b>{search === undefined ? NONE : search ? 'On' : 'Off'}</b></span>
        <span><b>{waiting ?? NONE}</b> {waiting === 1 ? 'proposal waits' : 'proposals wait'}</span>
      </footer>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const FLOW = 'flow-2026-10-03-1432'
/** Sample readings, from the Packet: the places the Factory flow's agent reads and writes, and what Cairn wrote there. */
const SAMPLE_READS = [
  {id: 'doc', name: 'Open document', path: `Control/user/flows/${FLOW}.html`, ring: 0, at: -150},
  {id: 'packet', name: 'Packet', path: 'The prepared context: the 3 items that you captured.', ring: 0, at: -60},
  {id: 'flows', name: 'Flows', path: 'Control/user/flows', ring: 1, at: -150},
  {id: 'factory', name: 'Factory', path: 'Work/Factory', ring: 2, at: -35},
  {id: 'wiki', name: 'Wiki', path: 'Control/agents/wiki', ring: 3, at: -118},
]
const SAMPLE_WRITES = [
  {id: 'flows', name: 'Flows', path: 'Control/user/flows', ring: 1, at: 140},
  {id: 'now', name: 'Factory · now', path: 'Work/Factory/ProjectCentral/now', ring: 2, at: 60},
]
const SAMPLE_RECEIPTS = [
  {id: 'r1', actor: 'Cairn', at: '21:58', place: 'now', kind: 'Modified', before: 'a4f1', after: '9c20'},
  {id: 'r2', actor: 'Cairn', at: '21:52', place: 'now', kind: 'Added'},
  {id: 'r3', actor: 'Cairn', at: '20:54', place: 'flows', kind: 'Modified', before: '5be2', after: 'd17a'},
]
/** The ground as a tree, with the open document and the Packet on it. */
const SAMPLE_TREE = [
  {id: 'packet', name: 'Packet · 3 items', depth: 0, ring: 0, read: 'packet', tag: 'prepared'},
  {id: 'root', name: 'Central', depth: 0, ring: 3},
  {id: 'flows', name: 'Control/user/flows', depth: 1, ring: 1, read: 'flows', write: 'flows', tag: 'scene'},
  {id: 'doc', name: FLOW, depth: 2, ring: 0, read: 'doc', write: 'answer', tag: 'object · open'},
  {id: 'wiki', name: 'Control/agents/wiki', depth: 1, ring: 3, read: 'wiki', tag: 'central'},
  {id: 'factory', name: 'Work/Factory', depth: 1, ring: 2, read: 'factory', tag: 'expression'},
  {id: 'now', name: 'ProjectCentral/now', depth: 2, ring: 2, write: 'now', tag: 'expression'},
]
const DEFAULTS = {
  light: 'lit', reach: 0, writeMode: 'propose', knowledge: false, document: FLOW,
  reads: JSON.stringify(SAMPLE_READS), writes: JSON.stringify(SAMPLE_WRITES), tree: JSON.stringify(SAMPLE_TREE),
  // Your requests: the open document and the packet are read; no place is written.
  'r:doc': true, 'r:packet': true, 'r:flows': false, 'r:factory': false, 'r:wiki': false, 'w:flows': false, 'w:now': false,
  // Readings from the owner: the receipts of the agent's writes, and the proposals that wait. The pages are held by the hand.
  receipts: '[]', waiting: 0, readsPage: 0, writesPage: 0,
}

export const design: DesignedDevice = {
  id: 'central:context-world',
  title: 'Context & world',
  kind: 'effect',
  defaults: DEFAULTS,
  fixtures: {
    'Open document': {},
    'Writes landed': {reach: 2, writeMode: 'write', knowledge: true, 'r:flows': true, 'r:factory': true, 'w:flows': true, 'w:now': true, receipts: JSON.stringify(SAMPLE_RECEIPTS)},
    'Outside the Reach': {reach: 1, 'r:flows': true, 'r:factory': true, 'r:wiki': true, 'w:now': true, waiting: 2},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Context & world" light={light(p)} readings={[reachName(p.v) ?? NONE, `${readsLit(p.v)?.length ?? NONE}r ${writesLit(p.v)?.length ?? NONE}w`]} onUnfold={p.nav.unfold} />,

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
      <Readout label="receipts" does="Receipts of the agent's writes. Press to open the places in a pane." value={receiptsOf(p.v)?.length} tone="accent" onPress={p.nav.full} />
    </Section>
  </Panel>,

  whole: p => {
    const [readPage, writePage] = [numOf(p.v, 'readsPage') ?? 0, numOf(p.v, 'writesPage') ?? 0], waiting = waitingOf(p.v), at = pending(p.v) ?? reach(p.v)
    return <Panel title="Context & world" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Reach and places" does={PICTURE} corner={cornerOf(p.v)}>
            <Rings v={p.v} set={p.set} w={194} h={146} labels />
          </Display>
        </Section>
        <Section label="Reach" width={80}>
          <Radio {...st(p, 'reach')} does="The widest area the agent can read from. A raise waits for Confirm." value={at === undefined ? '' : String(at)} stack
            options={LEVELS.map((name, i) => ({value: String(i), label: name}))} onChange={x => askReach(p)(Number(x))} pending={holds(p)} />
          <Consent p={p} />
        </Section>
        <Section grow>
          <WritesRadio p={p} label="Writes elsewhere" />
          <Readout label="waiting" does="Proposals that wait for your approval." value={waiting} tone={waiting ? 'stall' : undefined} />
        </Section>
      </Band>
      <Band>
        <Section width={148}>
          <Rows label="Reads" does="The places the agent may read. The square is your request; teal marks a place inside the Reach."
            items={readRows(p.v)} size={5} page={readPage} onPage={n => p.set('readsPage', n)} onRequest={(id, now) => p.set(`r:${id}`, now)} />
          <SearchToggle p={p} />
        </Section>
        <Section width={124}>
          <Rows label="Writes to"
            does="The places the agent may write. The square is your request; amber marks a place inside the Reach. The note counts receipts." items={writeRows(p.v)} size={5}
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
    const last = receiptsOf(p.v)?.[0], reading = readsLit(p.v)?.length, writing = writesLit(p.v)?.length
    return <Tile title="Context & world" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={104} h={104} label="Reach and places" does="The rings, the Reach and the places that the agent reads and writes. Press the receipt to open them.">
        <Rings v={p.v} w={104} h={104} tile />
      </Display>
      <div className="ref-tile-side">
        <Readout label="reach" does="The widest area the agent can read from." value={reachName(p.v)} tone="value" />
        <Readout label="read · write" does="Places that the agent reads, and places that it writes."
          value={reading === undefined && writing === undefined ? undefined : `${reading ?? NONE} · ${writing ?? NONE}`} />
        <Readout label="last receipt" does="The time of the agent's last write. Press to open the places in a pane."
          value={receiptsOf(p.v) === undefined ? undefined : last ? last.at ?? NONE : 'none'} tone="accent" onPress={last ? p.nav.full : undefined} />
      </div>
    </Tile>
  },
}
