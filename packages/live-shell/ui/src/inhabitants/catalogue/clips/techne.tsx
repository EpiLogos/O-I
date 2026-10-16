// Technē's clip (manual §17.1): an event at its year and place, or a stop of a walk. Clip view shows first how sure anyone is of
// it, its span and what it gathered. The Clip panel holds the event's readings (name, kind, standing, date, span, place, source,
// parent) or the stop's parts (place, moment, thing, scene, narration); Launch holds the arrival and what comes after the stop.
// An event has no tools and no envelopes. The editor's tabs: the material it gathers, its relations in the line of their
// standing, the bounded whole it belongs to, and its source.
//
// The owner's material: `kind` (event | stop), the readings on their keys, `material` (JSON rows {at, kind, text, source}),
// `relations` (JSON rows {type, to, standing, by}), `constellation` (JSON {nodes: [{id, label}], edges: [{from, to, standing}]}),
// `source.text`, `source.ref`, `source.revision`, `source.admitted`.
import {Chooser, ValueBox} from '../../sdk/panel'
import {numOf, strOf} from '../panels/design'
import {Fact, Fields, Rows, Row, Rule, Said, Wide, choice, read} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

const STANDING: Readonly<Record<string, {word: string; line: 'solid' | 'dashed' | 'dotted'; tone?: 'stall' | 'green' | 'value'}>> = {
  fact: {word: 'Fact', line: 'solid', tone: 'green'}, claim: {word: 'Claim', line: 'solid'}, inference: {word: 'Inference', line: 'dashed'},
  guess: {word: 'Guess', line: 'dotted'}, dispute: {word: 'Dispute', line: 'solid', tone: 'stall'}, gap: {word: 'Gap', line: 'dotted'},
}
const isStop = (v: ClipProps['v']) => strOf(v, 'kind') === 'stop'

function ClipPanel(p: ClipProps) {
  if (isStop(p.v)) return <Rows>
    <Row label="Place"><Fact label="Place" does="Where the World goes when the walk reaches the stop." value={strOf(p.v, 'stop.place')} /></Row>
    <Row label="Moment"><Fact label="Moment" does="Where the clock goes. The sky and the Timeline go there too." value={strOf(p.v, 'stop.moment')} /></Row>
    <Row label="Thing"><Fact label="Thing" does="What the stop is about: a note, a source or a person." value={strOf(p.v, 'stop.thing')} /></Row>
    <Row label="Scene"><Fact label="Scene" does="The Expression scene that launches at the stop." value={strOf(p.v, 'stop.scene')} tone="value" /></Row>
    <Rule />
    <Wide><Said>{strOf(p.v, 'stop.narration') ? `“${strOf(p.v, 'stop.narration')}”` : 'The stop has no narration.'}</Said></Wide>
    <Said>A stop with no place, no moment or no scene shows that it holds none.</Said>
  </Rows>
  const standing = STANDING[strOf(p.v, 'standing') ?? '']
  return <Rows>
    <Row label="Name"><Fact label="Name" does="The event's name, as its source gives it." value={strOf(p.v, 'name')} /></Row>
    <Row label="Kind"><Fact label="Kind" does="What sort of event it is, as its stream names it." value={strOf(p.v, 'event.kind')} /></Row>
    <Row label="Standing"><Fact label="Standing" does={`How sure anyone is of it. Its line on the ruler is ${standing?.line ?? 'drawn by its standing'}. Placement does not raise it.`}
      value={standing?.word} tone={standing?.tone} /></Row>
    <Row label="Date"><Fact label="Date" does="When it happened, at the precision its source states, in the source's words." value={strOf(p.v, 'date')} /></Row>
    <Row label="Span"><Fact label="Span" does="The life of the event on the ruler: its start and its end. The loop brace over it is the occasion window." value={strOf(p.v, 'span')} /></Row>
    <Row label="Place"><Fact label="Place" does="Where it happened. An empty place stays empty." value={strOf(p.v, 'place')} /></Row>
    <Row label="Source"><Fact label="Source" does="Where the reading took it from, at its revision." value={strOf(p.v, 'source.ref') ? `${strOf(p.v, 'source.ref')} @ ${strOf(p.v, 'source.revision') ?? '—'}` : undefined} /></Row>
    <Row label="Parent"><Fact label="Parent" does="The event that holds it. Zooming out folds it into the parent." value={strOf(p.v, 'parent')} /></Row>
  </Rows>
}

function LaunchPanel(p: ClipProps) {
  return <>
    <Said>Launching it stands it: the clock goes to its moment, the World to its place, and the scenes it carries launch.</Said>
    <Fields>
      <Wide><Chooser label="Arrival" does="How the walk reaches this stop. Global follows the transport's Quantize." value={choice(p.v, 'arrival')} onChange={x => p.set('arrival', x)}
        options={[{value: 'global', label: 'Global'}, {value: 'fly', label: 'Fly'}, {value: 'cut', label: 'Cut'}, {value: 'fade', label: 'Fade'}]} /></Wide>
      <Wide><Chooser label="Follow action" does="What happens when the stop ends. Next stop on one track steps down its clips; a walk through several Expressions steps from row to row."
        value={choice(p.v, 'follow')} onChange={x => p.set('follow', x)} options={[{value: 'next', label: 'Next stop'}, {value: 'stay', label: 'Stay'}, {value: 'start', label: 'Return to start'}]} /></Wide>
    </Fields>
    <Rule />
    <Fields>
      <ValueBox label="Transition" does="The length of the change into the next stop." value={numOf(p.v, 'transition') ?? NaN} def={1} scale={{min: 0, max: 10, step: 0.1}} format={x => `${x.toFixed(1)} s`} onChange={x => p.set('transition', x)} />
      <Chooser label="Curve" does="The shape of that change." value={choice(p.v, 'curve')} onChange={x => p.set('curve', x)}
        options={[{value: 'linear', label: 'Linear'}, {value: 'in', label: 'Ease in'}, {value: 'out', label: 'Ease out'}, {value: 'both', label: 'Ease both'}]} />
      <Wide><Chooser label="Switch" does="When the next stop's scene takes over." value={choice(p.v, 'switch')} onChange={x => p.set('switch', x)}
        options={[{value: 'once', label: 'At once'}, {value: 'step', label: 'In step'}, {value: 'end', label: 'At end of scene'}]} /></Wide>
    </Fields>
  </>
}

interface Material {readonly at: string; readonly kind: string; readonly text: string; readonly source?: string}
interface Relation {readonly type: string; readonly to: string; readonly standing: string; readonly by?: string}

function MaterialTab(p: ClipProps) {
  const rows = read<Material[]>(p.v, 'material', [])
  if (!rows.length) return <Said>No reading of what the event gathers.</Said>
  return <ul className="clv-list" aria-label="Material">
    {rows.map((row, i) => <li key={i} data-i={`${row.kind}|${row.text}${row.source ? ` (${row.source})` : ''}. Follow it back to the line it came from.`}>
      <span className="clv-at">{row.at}</span><span className="clv-chip">{row.kind}</span><span className="clv-text">{row.text}</span><span className="clv-tag">{row.source ?? ''}</span>
    </li>)}
  </ul>
}

function RelationsTab(p: ClipProps) {
  const rows = read<Relation[]>(p.v, 'relations', [])
  if (!rows.length) return <Said>No relations are read for the event.</Said>
  return <ul className="clv-list" aria-label="Relations">
    {rows.map((row, i) => {
      const standing = STANDING[row.standing]
      return <li key={i} data-tone={standing?.tone === 'stall' ? 'stall' : undefined} style={{gridTemplateColumns: '96px 78px minmax(0, 1fr) auto'}}
        data-i={`${row.type}|${row.to}, ${standing?.word ?? row.standing}${row.by ? `, stated by ${row.by}` : ''}. The line is drawn by its standing.`}>
        <span className="clv-at"><svg className="clv-line" width={24} height={6} aria-hidden="true"><line x1={0} x2={24} y1={3} y2={3} className="clv-edge" data-standing={row.standing} /></svg>{standing?.word ?? row.standing}</span><span className="clv-chip">{row.type}</span><span className="clv-text">{row.to}</span><span className="clv-tag">{row.by ?? ''}</span>
      </li>
    })}
  </ul>
}

function ConstellationTab(p: ClipProps) {
  const graph = read<{nodes: {id: string; label: string}[]; edges: {from: string; to: string; standing: string}[]}>(p.v, 'constellation', {nodes: [], edges: []})
  if (!graph.nodes.length) return <Said>No reading of the whole the event belongs to.</Said>
  const w = p.room.w, h = p.room.h, cx = w / 2, cy = h / 2, r = Math.min(w * 0.36, h * 0.38)
  const focus = graph.nodes[0]!, others = graph.nodes.slice(1)
  const at = new Map<string, [number, number]>([[focus.id, [cx, cy]]])
  others.forEach((node, i) => { const a = -Math.PI / 2 + i / others.length * Math.PI * 2; at.set(node.id, [cx + r * 1.35 * Math.cos(a), cy + r * Math.sin(a)]) })
  return <svg className="clv-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Constellation"
    data-i="Constellation|The bounded whole the event belongs to, drawn round it. Each line takes the line of its standing.">
    <ellipse cx={cx} cy={cy} rx={r * 1.35 + 40} ry={r + 22} className="clv-bound" />
    {graph.edges.map((edge, i) => { const a = at.get(edge.from), b = at.get(edge.to); return a && b ? <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="clv-edge" data-standing={edge.standing} /> : null })}
    {graph.nodes.map(node => { const [x, y] = at.get(node.id)!; const focused = node.id === focus.id
      return <g key={node.id}><circle cx={x} cy={y} r={focused ? 7 : 5} className="clv-node" data-focus={focused ? 'true' : undefined} />
        <text x={x + 10} y={y + 3} className="clv-node-label">{node.label}</text></g> })}
  </svg>
}

function SourceTab(p: ClipProps) {
  const text = strOf(p.v, 'source.text')
  return <div className="clv-page">
    {text ? <pre className="clv-source" data-i="Source|The source at its revision. Follow a passage back and you land on the line it came from.">{text}</pre> : <Said>No reading of the source.</Said>}
    <div className="clv-margin">
      <span className="clv-margin-head">Source</span>
      <div className="clv-note">{strOf(p.v, 'source.ref') ?? '—'}<small>revision {strOf(p.v, 'source.revision') ?? '—'}</small></div>
      <span className="clv-margin-head">Admission</span>
      <div className="clv-note">{strOf(p.v, 'source.admitted') ?? '—'}</div>
    </div>
  </div>
}

const NICAEA_MATERIAL = [
  {at: '325 May', kind: 'passage', text: 'The bishops gathered at Nicaea at the emperor\'s summons.', source: 'Eusebius, Vita Const. III.6'},
  {at: '325 Jun', kind: 'passage', text: 'The creed was drawn up and the word homoousios admitted.', source: 'Athanasius, De Decretis 19'},
  {at: '325 Jun', kind: 'occurrence', text: 'Arius exiled to Illyricum.', source: 'Socrates, HE I.8'},
  {at: '325 Jul', kind: 'passage', text: 'The date of Easter settled for the whole church.', source: 'Eusebius, Vita Const. III.18'},
  {at: '325 Aug', kind: 'occurrence', text: 'The council closes; the canons sent out.', source: 'Canons of Nicaea'},
]
const NICAEA_RELATIONS = [
  {type: 'convened by', to: 'Constantine I', standing: 'fact', by: 'Eusebius'},
  {type: 'answers', to: 'The Arian controversy', standing: 'fact', by: 'Athanasius'},
  {type: 'attended by', to: '318 bishops', standing: 'claim', by: 'Hilary of Poitiers'},
  {type: 'causes', to: 'The Council of Constantinople, 381', standing: 'inference', by: 'reading: Late antiquity'},
  {type: 'echoes', to: 'The Council of Jerusalem', standing: 'guess', by: 'reading: Councils'},
  {type: 'dated', to: 'Opening on 20 May', standing: 'dispute', by: 'Socrates · Eusebius'},
]
const NICAEA_GRAPH = {
  nodes: [{id: 'n', label: 'Council of Nicaea'}, {id: 'c', label: 'Constantine I'}, {id: 'a', label: 'Arius'}, {id: 'at', label: 'Athanasius'}, {id: 'k', label: 'Constantinople, 381'}, {id: 'e', label: 'Easter reckoning'}],
  edges: [{from: 'n', to: 'c', standing: 'fact'}, {from: 'n', to: 'a', standing: 'fact'}, {from: 'n', to: 'at', standing: 'claim'}, {from: 'n', to: 'k', standing: 'inference'}, {from: 'n', to: 'e', standing: 'fact'}, {from: 'a', to: 'k', standing: 'guess'}],
}
const NICAEA_SOURCE = `Eusebius, Life of Constantine, III.6–7

Then, as if to bring a divine array against this enemy, he
convoked a general council, and invited the speedy attendance of
bishops from all quarters, in letters expressive of the honourable
estimation in which he held them. …

The most distinguished of God's ministers from all the churches
which abounded in Europe, Libya, and Asia were here assembled.`

export const clip: DesignedClip = {
  id: 'clip:techne',
  mode: 'techne',
  title: 'A Technē event',
  head: {name: 'name', colour: 'colour'},
  defaults: {
    kind: 'event', name: 'Council of Nicaea', colour: 'var(--w-ariadne)', 'event.kind': 'Council', standing: 'fact', date: '325 (May – August)', span: '20 May 325 – 25 Aug 325',
    place: 'Nicaea, Bithynia', 'source.ref': 'Eusebius, Vita Constantini III.6', 'source.revision': 'r12', 'source.admitted': 'Admitted · reading Late antiquity · 3 Oct',
    parent: 'The Constantinian settlement', material: JSON.stringify(NICAEA_MATERIAL), relations: JSON.stringify(NICAEA_RELATIONS), constellation: JSON.stringify(NICAEA_GRAPH),
    'source.text': NICAEA_SOURCE, arrival: 'global', follow: 'next', transition: 1, curve: 'linear', switch: 'once',
    'view.panel': 'clip', 'view.editor': 'relations',
  },
  fixtures: {
    'An event': {},
    'A stop of a walk': {kind: 'stop', name: 'Stop 3 · Nicaea', colour: 'var(--w-satya)', 'stop.place': 'Nicaea, Bithynia', 'stop.moment': '20 May 325', 'stop.thing': 'The creed',
      'stop.scene': 'Councils · scene 3 · The creed in the field', 'stop.narration': 'Here the word that would divide the church for a century is spoken.', arrival: 'fade', transition: 2.5, curve: 'both', switch: 'end', 'view.panel': 'launch', 'view.editor': 'material'},
    'A disputed event': {name: 'Opening of the council', standing: 'dispute', date: 'c. 20 May 325', span: undefined, place: undefined, 'view.editor': 'constellation'},
    'No readings': {name: undefined, 'event.kind': undefined, standing: undefined, date: undefined, span: undefined, place: undefined, 'source.ref': undefined, parent: undefined,
      material: undefined, relations: undefined, constellation: undefined, 'source.text': undefined},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'The event\'s readings: its standing, span, place and provenance. A stop\'s parts: its place, moment, thing, scene and narration.', draw: ClipPanel},
    {id: 'launch', label: 'Launch', does: 'How the walk arrives at it, and what comes after it.', draw: LaunchPanel},
  ],
  tools: [],
  editor: [
    {id: 'material', label: 'Material', does: 'The passages and occurrences the event gathers, by time.', draw: MaterialTab},
    {id: 'relations', label: 'Relations', does: 'The event\'s typed relations, each in the line of its standing.', draw: RelationsTab},
    {id: 'constellation', label: 'Constellation', does: 'The bounded whole the event belongs to, drawn round it.', draw: ConstellationTab},
    {id: 'source', label: 'Source', does: 'The source at its revision, and how it was admitted.', draw: SourceTab},
  ],
}
