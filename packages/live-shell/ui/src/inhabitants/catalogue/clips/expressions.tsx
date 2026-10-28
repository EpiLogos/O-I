// Expressions' clip (manual §20.1): a scene of an Expression. Clip view shows the sequence first, with the sound beneath it, so both
// sides of the scene are shaped together. The Clip panel holds the scene's name, colour, length, transition, signature, start and
// lock, and what the scene carries as its body (as a Live audio clip carries its sample). Launch holds the quantize, the follow
// action (Jump to a scene is Live's Jump) and the scene's triggers, which Live has no counterpart for. Panel two holds the tools:
// the pointer tools, Text, Blueprint and Arrange. The editor's tabs: Sequence (one lane per symbol, its states as steps with hold
// and glide, the sound beneath), Envelopes (the scene's automation: Replace is Live's Automation, Add and Multiply its Modulation),
// Expression (the selected symbol's own controls: Formation, Force, Sound and Meaning, as Live's MPE tab holds a note's own), and
// Sound (the plate and the voices at full height).
//
// The owner's material, all JSON on value keys: `symbols` ({id, name, steps: [{at, hold, glide, state}]}), `objects` ({<symbol id>:
// {formation, force, sound, meaning}}), `lanes` (the automation lanes), `plate` ([[second, hertz]…]), `layers` (the text layers),
// `triggers`, `scenes` (the Expression's scenes, for Jump).
import {Action, Chooser, Dial, Display, Radio, Section, TextField, Toggle, ValueBox, type Option} from '../../sdk/panel'
import {numOf, strOf} from '../panels/design'
import {Caption, COLOURS, EnvelopeEditor, Fields, LaneGrid, GrooveOf, GrooveReading, GrooveSwap, MadeOf, grooved, Rows, Row, Rule, Said, Wide, choice, read, write, type Block, type Lane} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

type V = ClipProps['v']
interface Step {readonly at: number; readonly hold: number; readonly glide: number; readonly state: string}
interface Glyph {readonly id: string; readonly name: string; readonly steps: readonly Step[]}
type Obj = Record<string, Record<string, number | string | boolean>>
interface AutoLane {
  readonly id: string; readonly device: string; readonly target: string; readonly type: 'oscillator' | 'ramp'; readonly wave: string; readonly rate: number; readonly phase: number
  readonly min: number; readonly max: number; readonly blend: 'replace' | 'add' | 'multiply'; readonly duration: number; readonly delay: number; readonly loop: string; readonly easing: string
  readonly enabled: boolean; readonly follows?: string
}

const symbolsOf = (v: V) => read<Glyph[]>(v, 'symbols', [])
const objectsOf = (v: V) => read<Record<string, Obj>>(v, 'objects', {})
const lanesOf = (v: V) => read<AutoLane[]>(v, 'lanes', [])
const sceneEnd = (v: V) => (numOf(v, 'duration') ?? 8) + (numOf(v, 'transition') ?? 2)
const secs = (t: number) => `${t.toFixed(t < 10 && t % 1 ? 1 : 0)} s`
const selected = (v: V) => strOf(v, 'symbol') ?? symbolsOf(v)[0]?.id

/** Set one value of the selected symbol's own controls (its page of `objects`). */
function setObj(p: ClipProps, page: string, key: string, value: number | string | boolean) {
  const id = selected(p.v)
  if (!id) return
  const all = objectsOf(p.v), mine = all[id] ?? {}
  write(p, 'objects', {...all, [id]: {...mine, [page]: {...(mine[page] ?? {}), [key]: value}}})
}
const objVal = (v: V, page: string, key: string): number | string | boolean | undefined => {
  const id = selected(v)
  return id ? objectsOf(v)[id]?.[page]?.[key] : undefined
}
const objNum = (v: V, page: string, key: string) => { const x = objVal(v, page, key); return typeof x === 'number' ? x : NaN }
const objStr = (v: V, page: string, key: string) => { const x = objVal(v, page, key); return typeof x === 'string' ? x : '' }
const objBool = (v: V, page: string, key: string) => objVal(v, page, key) === true

// ---------------------------------------------------------------- panel one

function ClipPanel(p: ClipProps) {
  const locked = p.v.locked === true
  const why = locked ? 'The scene is locked. Unlock it to change it.' : undefined
  return <Rows>
    <Row label="Name"><TextField label="Scene name" does="The name of the clip. Press Enter to keep a change, Escape to undo it." value={strOf(p.v, 'name') ?? ''} onChange={x => p.set('name', x)} disabled={why} /></Row>
    <Row label="Constellation"><MadeOf p={p} what="the scene" /></Row>
    <Row label="Groove"><GrooveOf p={p} /><GrooveSwap p={p} /></Row>
    {grooved(p.v) && <Row label="Reading"><GrooveReading p={p} /></Row>}
    <Row label="Colour"><Chooser label="Colour" does="The colour of the clip on the grid and the ruler." value={choice(p.v, 'colour')} options={COLOURS} onChange={x => p.set('colour', x)} /></Row>
    <Row label="Duration"><ValueBox label="Duration" does="How long the scene holds before it changes. This is the clip's length." value={numOf(p.v, 'duration') ?? NaN} def={8} scale={{min: 0, max: 60, step: 0.5}} format={secs} onChange={x => p.set('duration', x)} disabled={why} /></Row>
    <Row label="Transition"><ValueBox label="Transition" does="How long the change to the next scene takes." value={numOf(p.v, 'transition') ?? NaN} def={2} scale={{min: 0, max: 60, step: 0.5}} format={secs} onChange={x => p.set('transition', x)} disabled={why} /></Row>
    <Row label="Signature"><Chooser label="Signature" does="The scene's ratio of hold to change. The transport's time signature shows it for the scene that plays." value={choice(p.v, 'signature')} onChange={x => p.set('signature', x)}
      options={['5:3', '4:2', '3:3', '2:1'].map(r => ({value: r, label: r}))} disabled={why} /></Row>
    <Row label="Start"><ValueBox label="Start" does="Where the scene starts inside its own evolution. Slip on the ruler sets it." value={numOf(p.v, 'start') ?? NaN} def={0} scale={{min: 0, max: 60, step: 0.5}} format={secs} onChange={x => p.set('start', x)} disabled={why} /></Row>
    <Row label="Locked"><Toggle label="Locked" does="A locked scene refuses edits." on={locked} onChange={x => p.set('locked', x)} /></Row>
    <Rule />
    <Row label="Carrier"><Chooser label="Carrier" does="What the scene carries as its body." value={choice(p.v, 'carrier')} onChange={x => p.set('carrier', x)}
      options={['Engine composition', 'Text source', 'Glyph form', 'Image', 'File', 'Knowledge whole', 'HTML surface', 'Agent surface', 'Another Expression'].map(c => ({value: c.toLowerCase(), label: c}))} /></Row>
    <Row label="Shows"><Chooser label="Presentation" does="How the body shows. A presentation the carrier cannot show is refused." value={choice(p.v, 'presentation')} onChange={x => p.set('presentation', x)}
      options={[{value: 'live', label: 'Live'}, {value: 'inline', label: 'Inline'}, {value: 'preview', label: 'Preview'}, {value: 'degraded', label: 'Degraded'}]} /></Row>
    <Row label="Reference"><TextField label="Reference" does="Where the body comes from: a file reference or a path." value={strOf(p.v, 'reference') ?? ''} onChange={x => p.set('reference', x)} /></Row>
    <Row label="Span">
      <ValueBox label="Span start" does="Where the part of the file to use starts. 0 to 0 is the whole file." value={numOf(p.v, 'span.from') ?? NaN} def={0} scale={{min: 0, max: 8000000, step: 1}} format={x => String(x)} onChange={x => p.set('span.from', x)} />
      <ValueBox label="Span end" does="Where the part of the file to use ends." value={numOf(p.v, 'span.to') ?? NaN} def={0} scale={{min: 0, max: 8000000, step: 1}} format={x => String(x)} onChange={x => p.set('span.to', x)} />
    </Row>
  </Rows>
}

interface Trigger {readonly name: string; readonly occasion: string; readonly target: string; readonly placement: string; readonly operation: string}

function LaunchPanel(p: ClipProps) {
  const scenes = read<{id: string; name: string}[]>(p.v, 'scenes', [])
  const triggers = read<Trigger[]>(p.v, 'triggers', [])
  const at = Math.max(0, triggers.findIndex(t => t.name === strOf(p.v, 'trigger')))
  const trig = triggers[at]
  const setTrig = (key: keyof Trigger, value: string) => write(p, 'triggers', triggers.map((t, i) => (i === at ? {...t, [key]: value} : t)))
  const opt = (xs: readonly string[]): Option<string>[] => xs.map(x => ({value: x, label: x}))
  return <Rows>
    <Row label="Quantize"><Chooser label="Quantize" does="When the scene's launch lands. Global follows the transport's Quantize." value={choice(p.v, 'quantize')} onChange={x => p.set('quantize', x)}
      options={[{value: 'global', label: 'Global'}, {value: 'now', label: 'Now'}, {value: 'beat', label: 'Next beat'}, {value: 'scene', label: 'Scene end'}]} /></Row>
    <Row label="Follow"><Chooser label="Follow action" does="What comes after the scene. Jump to a scene is Live's follow action Jump." value={choice(p.v, 'follow')} onChange={x => p.set('follow', x)}
      options={[{value: 'next', label: 'Next scene'}, {value: 'jump', label: 'Jump to a scene'}, {value: 'stop', label: 'Stop'}]} /></Row>
    <Row label="Jump to"><Chooser label="Jump to" does="The scene that Jump to a scene launches." value={choice(p.v, 'jumpTo')} options={scenes.map(s => ({value: s.id, label: s.name}))} onChange={x => p.set('jumpTo', x)}
      disabled={choice(p.v, 'follow') === 'jump' ? undefined : 'Set the follow action to Jump to a scene first.'} /></Row>
    <Rule />
    <Caption right={<span className="clv-tag">{triggers.length} of 8</span>}>Triggers</Caption>
    {trig ? <>
      <Row label="Trigger"><Chooser label="Trigger" does="The trigger whose settings show below. A trigger's name is 1 to 128 letters, digits, dots, dashes or underscores." value={trig.name}
        options={triggers.map(t => ({value: t.name, label: t.name}))} onChange={x => p.set('trigger', x)} /></Row>
      <Row label="When"><Chooser label="Occasion" does="When the trigger runs." value={trig.occasion} options={opt(['Scene enters', 'Scene leaves', 'Activated', 'Selected', 'Sequence moves on'])} onChange={x => setTrig('occasion', x)} /></Row>
      <Row label="Does"><Chooser label="Target" does="What the trigger does." value={trig.target} options={opt(['Read this Expression', 'Open a portal', 'Run a native Action', 'Jump to a scene'])} onChange={x => setTrig('target', x)} /></Row>
      <Row label="Portal"><Chooser label="Portal placement" does="Where a portal opens." value={trig.placement} options={opt(['Preview', 'Overlay', 'Beside', 'Full', 'Detached', 'Re-dock'])} onChange={x => setTrig('placement', x)}
        disabled={trig.target === 'Open a portal' ? undefined : 'Only a portal trigger opens a portal.'} /></Row>
      <Row label="Read"><Chooser label="Operation" does="What a read trigger does." value={trig.operation} options={opt(['Inspect', 'List', 'Export'])} onChange={x => setTrig('operation', x)}
        disabled={trig.target === 'Read this Expression' ? undefined : 'Only a read trigger reads.'} /></Row>
    </> : <Said>The scene has no triggers.</Said>}
    <Said>Live has no counterpart for triggers: a Live clip does nothing when it is entered, left or touched, beyond its follow action.</Said>
  </Rows>
}

// ---------------------------------------------------------------- the tools

function PointerTool(p: ClipProps) {
  return <>
    <Radio label="Tool" does="What the pointer does in the field." value={choice(p.v, 'tool')} onChange={x => p.set('tool', x)} stack options={[
      {value: 'select', label: 'Select', does: 'Selects a symbol. Its controls open on the Expression tab.'},
      {value: 'orbit', label: 'Orbit', does: 'Turns the view of the field round its centre.'},
      {value: 'form', label: 'Form', does: 'Draws a form in the field.'},
      {value: 'bind', label: 'Bind', does: 'Ties the selected symbol to a source.'},
    ]} />
    <Action label="Library" does="Opens the Library of symbols and forms." onPress={() => p.set('library', Date.now())} />
    <Said>Capture is the transport's: it keeps your last gestures as a new scene.</Said>
  </>
}

interface Layer {readonly id: string; readonly visible: boolean; readonly heading: string; readonly title: string; readonly italic: string; readonly body: string; readonly size: number; readonly width: number; readonly x: number; readonly y: number; readonly align: string}

function TextTool(p: ClipProps) {
  const layers = read<Layer[]>(p.v, 'layers', [])
  const at = Math.max(0, layers.findIndex(l => l.id === strOf(p.v, 'layer')))
  const layer = layers[at]
  const put = (key: keyof Layer, value: string | number | boolean) => write(p, 'layers', layers.map((l, i) => (i === at ? {...l, [key]: value} : l)))
  const add = () => layers.length < 16 && write(p, 'layers', [...layers, {id: `t${layers.length + 1}`, visible: true, heading: 'A moment in the field', title: 'Your words,', italic: 'in this space.', body: '', size: 38, width: 240, x: 0.07, y: 0.24, align: 'left'}])
  return <Rows>
    <Row label="Layer">
      <Chooser label="Layer" does="The text block whose settings show below. A scene has up to 16." value={layer?.id ?? ''} options={layers.map((l, i) => ({value: l.id, label: `${i + 1} · ${l.title}`}))} onChange={x => p.set('layer', x)} />
    </Row>
    {layer ? <>
      <Row label="Visible"><Toggle label="Visible" does="Shows or hides the layer." on={layer.visible} onChange={x => put('visible', x)} />
        <Action label="Add layer" does="Adds a text layer. A scene has at most 16." onPress={layers.length < 16 ? add : undefined} disabled={layers.length >= 16 ? 'The scene has 16 layers.' : undefined} /></Row>
      <Row label="Heading"><TextField label="Small heading" does="The first line, in small capitals." value={layer.heading} onChange={x => put('heading', x)} /></Row>
      <Row label="Title"><TextField label="Title" does="The main line." value={layer.title} onChange={x => put('title', x)} /></Row>
      <Row label="Italic"><TextField label="Italic line" does="The line in italics." value={layer.italic} onChange={x => put('italic', x)} /></Row>
      <Row label="Text"><TextField label="Supporting text" does="The body text. It can have several lines." value={layer.body} placeholder="Supporting text" onChange={x => put('body', x)} /></Row>
      <Row label="Size">
        <ValueBox label="Type size" does="The size of the title." value={layer.size} def={38} scale={{min: 14, max: 150, step: 1}} format={x => String(x)} onChange={x => put('size', x)} />
        <ValueBox label="Block width" does="The width of the block." value={layer.width} def={240} scale={{min: 60, max: 1000, step: 10}} format={x => String(x)} onChange={x => put('width', x)} />
      </Row>
      <Row label="Place">
        <ValueBox label="Page position X" does="The place of the block across the page, as a share of the page. Drag the layer box to move it." value={layer.x} def={0.07} scale={{min: -0.5, max: 1.5, step: 0.01}} format={x => x.toFixed(2)} onChange={x => put('x', x)} />
        <ValueBox label="Page position Y" does="The place of the block down the page, as a share of the page." value={layer.y} def={0.24} scale={{min: -0.5, max: 1.5, step: 0.01}} format={x => x.toFixed(2)} onChange={x => put('y', x)} />
      </Row>
      <Row label="Align"><Radio label="Alignment" does="How lines line up in the block." value={layer.align} onChange={x => put('align', x)} options={[{value: 'left', label: 'Left'}, {value: 'centre', label: 'Centre'}, {value: 'right', label: 'Right'}]} /></Row>
    </> : <Said>The scene has no text. Add a layer.</Said>}
  </Rows>
}

function BlueprintTool(p: ClipProps) {
  const bound = p.v['bp.bound'] === true
  const why = bound ? undefined : 'Bind the six roles first.'
  const members = symbolsOf(p.v).slice(0, 6)
  const box = (key: string, label: string, does: string, min: number, max: number, def: number, step = 0.01) =>
    <ValueBox label={label} does={does} value={numOf(p.v, key) ?? NaN} def={def} scale={{min, max, step}} format={x => x.toFixed(step < 1 ? 2 : 0)} onChange={x => p.set(key, x)} disabled={why} />
  return <Rows>
    <Fields>
      <Wide><Action label="Bind sixfold roles" does="Assigns the six roles to the six symbols placed in the scene, one to six." onPress={bound ? undefined : () => p.set('bp.bound', true)} disabled={bound ? 'The figure is bound. Release it before you bind again.' : undefined} /></Wide>
      <Wide><Action label="Release" does="Frees the six symbols." onPress={bound ? () => p.set('bp.bound', false) : undefined} disabled={bound ? undefined : 'Nothing is bound.'} /></Wide>
    </Fields>
    <Said>{bound ? members.map((m, i) => `${i + 1} ${m.name}`).join(' · ') : 'Not bound.'}</Said>
    <Row label="Position">{box('bp.x', 'Position X', 'Where the whole figure stands, across. The centre handle in the plan moves it.', -4, 4, 0)}{box('bp.y', 'Position Y', 'Where the whole figure stands, up and down.', -4, 4, 0)}{box('bp.z', 'Position Z', 'Where the whole figure stands, in depth.', -4, 4, 0)}</Row>
    <Row label="Rotation">{box('bp.rx', 'Rotation X', 'Turns the whole figure about X, in degrees.', -180, 180, 0, 1)}{box('bp.ry', 'Rotation Y', 'Turns the whole figure about Y, in degrees.', -180, 180, 0, 1)}{box('bp.rz', 'Rotation Z', 'Turns the whole figure about Z, in degrees.', -180, 180, 0, 1)}</Row>
    <Row label="Size">{box('bp.size', 'Relative size', 'Scales the whole figure. The outer handle in the plan moves it.', 0.0001, 14, 1)}</Row>
  </Rows>
}

function ArrangeTool(p: ClipProps) {
  const syms = symbolsOf(p.v)
  const chosen = new Set((strOf(p.v, 'ar.objects') ?? '').split(',').filter(Boolean))
  return <Rows>
    <Caption>Objects</Caption>
    <div className="clv-checks">{syms.map(s => <Toggle key={s.id} label={s.name} does={`Arrange moves ${s.name}.`} on={chosen.has(s.id)}
      onChange={on => p.set('ar.objects', [...syms.map(x => x.id).filter(id => (id === s.id ? on : chosen.has(id)))].join(','))} />)}</div>
    <Row label="Rule"><Chooser label="Arrangement" does="The rule that sets the positions." value={choice(p.v, 'ar.rule')} onChange={x => p.set('ar.rule', x)}
      options={['Line', 'Column', 'Ring', 'Grid', 'Spiral', 'Align X', 'Align Y', 'Distribute X', 'Distribute Y', 'Laminate'].map(r => ({value: r.toLowerCase(), label: r}))} /></Row>
    <Row label="Plane"><Radio label="Plane" does="The plane that the rule works in." value={choice(p.v, 'ar.plane')} onChange={x => p.set('ar.plane', x)} options={['XY', 'XZ', 'YZ'].map(x => ({value: x, label: x}))} /></Row>
    <Wide><Action label="Apply" does="Moves the chosen symbols by the rule. One apply is one undo step." onPress={chosen.size ? () => p.set('ar.apply', Date.now()) : undefined} disabled={chosen.size ? undefined : 'Choose the objects first.'} /></Wide>
    <Said>The scene records the last arrangement you applied.</Said>
  </Rows>
}

// ---------------------------------------------------------------- the editor

function Sequence(p: ClipProps) {
  const syms = symbolsOf(p.v)
  if (!syms.length) return <Said>No reading of the scene's sequence yet.</Said>
  const objects = objectsOf(p.v)
  const voiced = (id: string) => objects[id]?.sound?.voice === true
  const shown = p.v.fold === true ? syms.filter(s => s.steps.length) : syms
  const lanes: Lane[] = shown.map(s => ({id: s.id, label: s.name, key: 'name', marked: voiced(s.id)}))
  const blocks: Block[] = shown.flatMap(s => s.steps.map((step, i) => ({id: `${s.id}.${i}`, lane: s.id, at: step.at, len: step.hold, glide: step.glide, label: step.state,
    tone: s.id === selected(p.v) ? 'accent' as const : 'value' as const, does: `${s.name}: ${step.state}, held ${secs(step.hold)}, changing over ${secs(step.glide)}.`})))
  const end = sceneEnd(p.v)
  const underH = Math.max(52, Math.round(p.room.h * 0.26))
  const laneH = Math.max(14, Math.min(30, Math.floor((p.room.h - 16 - underH) / Math.max(1, lanes.length))))
  return <LaneGrid lanes={lanes} blocks={blocks} from={0} to={end} major={1} minor={0.5} label={t => `${t}`} keyW={72} laneH={laneH} highlight={p.v.highlight === true}
    loop={p.v.loopScene === true ? {from: numOf(p.v, 'start') ?? 0, to: numOf(p.v, 'duration') ?? 8} : undefined}
    marks={[{at: numOf(p.v, 'duration') ?? 8, label: 'Transition', tone: 'value', does: 'The scene holds until here, then changes to the next over its transition.'}]}
    selected={undefined} onSelect={id => p.set('symbol', id.split('.')[0]!)} w={p.room.w} h={p.room.h}
    name="Sequence" does="One lane for each symbol, its states as steps: each step's hold, then its change into the next. Press a step to select its symbol."
    under={<SoundUnder p={p} from={0} to={end} h={underH} />} underH={underH} />
}

/** The sound beneath the sequence: the plate's pitch over the scene. A symbol's voice carries part of the torus's sound and has no pitch of its own
 * (manual §20.2), so no voice draws a line here. */
function SoundUnder({p, from, to, h}: {p: ClipProps; from: number; to: number; h: number}) {
  const plate = read<[number, number][]>(p.v, 'plate', [])
  const keyW = 72, w = p.room.w, inner = w - keyW, x = (t: number) => keyW + (t - from) / (to - from) * inner
  const lo = Math.log(55), hi = Math.log(1760), y = (hz: number) => h - 6 - (Math.log(hz) - lo) / (hi - lo) * (h - 14)
  const d = plate.map(([t, hz], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(hz).toFixed(1)}`).join(' ')
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="clv-stems" data-i="Sound|What the scene sounds like: the plate's pitch over the scene.">
    <rect x={0} y={0} width={keyW} height={h} className="clv-key" data-key="gutter" />
    <text x={4} y={11} className="clv-axis">Sound</text>
    <text x={keyW - 4} y={y(880) + 3} className="clv-axis" textAnchor="end">880</text>
    <text x={keyW - 4} y={y(110) + 3} className="clv-axis" textAnchor="end">110</text>
    {d && <path d={d} className="clv-env-line" data-tone="value" />}
  </svg>
}

const DEVICE_LABEL = (v: V, device: string) => symbolsOf(v).find(s => s.id === device)?.name ?? device

function Envelopes(p: ClipProps) {
  const lanes = lanesOf(p.v)
  if (!lanes.length) return <Said>The scene has no automation lanes. Add a lane to move one target.</Said>
  const devices = [...new Set(lanes.map(l => l.device))]
  const device = devices.includes(strOf(p.v, 'env.device') ?? '') ? strOf(p.v, 'env.device')! : devices[0]!
  const mine = lanes.filter(l => l.device === device)
  const lane = mine.find(l => l.id === strOf(p.v, 'env.lane')) ?? mine[0]!
  const leader = lane.follows ? lanes.find(l => l.id === lane.follows) : undefined
  const shape = leader ? {...lane, type: leader.type, wave: leader.wave, rate: leader.rate, phase: leader.phase, duration: leader.duration, delay: leader.delay, loop: leader.loop, easing: leader.easing} : lane
  const put = (key: keyof AutoLane, value: string | number | boolean) => write(p, 'lanes', lanes.map(l => (l.id === lane.id ? {...l, [key]: value} : l)))
  const end = sceneEnd(p.v)
  const curve = (t: number) => {
    if (!lane.enabled) return lane.min
    const u = shape.type === 'oscillator' ? waveAt(shape.wave, shape.phase + shape.rate * t) : rampAt(shape, t)
    return lane.min + (lane.max - lane.min) * u
  }
  const fmt = (x: number) => (Math.abs(lane.max - lane.min) >= 10 ? x.toFixed(0) : x.toFixed(2))
  const following = leader ? `Follows ${leader.target}: its shape is the leader's.` : undefined
  return <EnvelopeEditor p={p} devices={devices.map(d => ({value: d, label: DEVICE_LABEL(p.v, d)}))} device={device} onDevice={x => { p.set('env.device', x); p.set('env.lane', undefined) }}
    controls={mine.map(l => ({value: l.id, label: l.target}))} control={lane.id} onControl={x => p.set('env.lane', x)}
    mode={lane.blend === 'replace' ? 'automation' : 'modulation'} onMode={x => put('blend', x === 'automation' ? 'replace' : 'add')}
    linked onLinked={() => undefined} points={[]} curve={curve} min={Math.min(lane.min, lane.max) - Math.abs(lane.max - lane.min) * 0.1} max={Math.max(lane.min, lane.max) + Math.abs(lane.max - lane.min) * 0.1}
    format={fmt} from={0} to={end} major={1} minor={0.5} label={t => `${t}`} w={p.room.w} h={p.room.h} sideW={300}
    side={<Rows>
      <Row label="Type"><Radio label="Type" does="A wave that repeats, or a ramp from the minimum to the maximum." value={shape.type} onChange={x => put('type', x)} disabled={following}
        options={[{value: 'oscillator', label: 'Oscillator'}, {value: 'ramp', label: 'Ramp'}]} /></Row>
      <Row label="Wave"><Chooser label="Wave" does="The shape of an oscillator. Morph drive follows the Morph device." value={shape.wave} onChange={x => put('wave', x)} disabled={following ?? (shape.type === 'ramp' ? 'A ramp has no wave.' : undefined)}
        options={['Sine', 'Triangle', 'Square', 'Saw', 'Random step', 'Smooth random', 'Morph drive'].map(w => ({value: w.toLowerCase(), label: w}))} /></Row>
      <Row label="Rate">
        <ValueBox label="Rate" does="How fast the wave cycles." value={shape.rate} def={0.5} scale={{min: 0, max: 2, step: 0.01}} format={x => x.toFixed(2)} onChange={x => put('rate', x)} disabled={following} />
        <ValueBox label="Phase" does="Where in the cycle the lane starts." value={shape.phase} def={0} scale={{min: 0, max: 1, step: 0.01}} format={x => x.toFixed(2)} onChange={x => put('phase', x)} disabled={following} />
      </Row>
      <Row label="Range">
        <ValueBox label="Minimum" does="The lowest value the lane writes." value={lane.min} scale={{min: -1000, max: 1000, step: 0.01}} format={fmt} onChange={x => put('min', x)} />
        <ValueBox label="Maximum" does="The highest value the lane writes." value={lane.max} scale={{min: -1000, max: 1000, step: 0.01}} format={fmt} onChange={x => put('max', x)} />
      </Row>
      <Row label="Blend"><Radio label="Blend" does="How the lane combines with the value you set. Replace is Live's Automation; Add to base and Multiply base are Live's Modulation." value={lane.blend} onChange={x => put('blend', x)}
        options={[{value: 'replace', label: 'Replace'}, {value: 'add', label: 'Add'}, {value: 'multiply', label: 'Multiply'}]} /></Row>
      <Row label="Ramp">
        <ValueBox label="Duration" does="The length of a ramp." value={shape.duration} def={4} scale={{min: 0.01, max: 30, step: 0.01}} format={secs} onChange={x => put('duration', x)} disabled={following ?? (shape.type === 'oscillator' ? 'An oscillator has no duration.' : undefined)} />
        <ValueBox label="Delay" does="The wait before a ramp starts." value={shape.delay} def={0} scale={{min: 0, max: 10, step: 0.01}} format={secs} onChange={x => put('delay', x)} disabled={following ?? (shape.type === 'oscillator' ? 'An oscillator has no delay.' : undefined)} />
      </Row>
      <Row label="End">
        <Chooser label="Loop" does="What a ramp does at its end." value={shape.loop} onChange={x => put('loop', x)} disabled={following}
          options={[{value: 'once', label: 'Once'}, {value: 'loop', label: 'Loop'}, {value: 'pingpong', label: 'Ping-pong'}]} />
        <Chooser label="Easing" does="The curve of a ramp." value={shape.easing} onChange={x => put('easing', x)} disabled={following}
          options={['Linear', 'Smooth', 'Ease in', 'Ease out', 'Elastic', 'Bounce'].map(e => ({value: e.toLowerCase(), label: e}))} />
      </Row>
      <Row label="Follows"><Chooser label="Follows" does="A lane can follow a leader: it takes the leader's shape and keeps its own range, blend and state." value={lane.follows ?? ''}
        options={[{value: '', label: 'No leader'}, ...lanes.filter(l => l.id !== lane.id).map(l => ({value: l.id, label: l.target}))]} onChange={x => put('follows', x)} /></Row>
      <Row label="Enabled"><Toggle label="Enabled" does="Turns the lane on or off." on={lane.enabled} onChange={x => put('enabled', x)} /></Row>
    </Rows>} />
}

const waveAt = (wave: string, x: number) => {
  const f = x - Math.floor(x)
  switch (wave) {
    case 'triangle': return f < 0.5 ? f * 2 : 2 - f * 2
    case 'square': return f < 0.5 ? 1 : 0
    case 'saw': return f
    case 'random step': return (Math.sin(Math.floor(x) * 12.9898) * 43758.5453) % 1 * 0.5 + 0.5
    default: return 0.5 + 0.5 * Math.sin(f * Math.PI * 2)
  }
}
const rampAt = (lane: Pick<AutoLane, 'duration' | 'delay' | 'loop' | 'easing'>, t: number) => {
  const local = t - lane.delay
  if (local <= 0) return 0
  const k = local / Math.max(0.01, lane.duration)
  const u = lane.loop === 'once' ? Math.min(1, k) : lane.loop === 'pingpong' ? (Math.floor(k) % 2 ? 1 - (k % 1) : k % 1) : k % 1
  switch (lane.easing) {
    case 'linear': return u
    case 'ease in': return u * u
    case 'ease out': return 1 - (1 - u) * (1 - u)
    default: return u * u * (3 - 2 * u)
  }
}

const PAGES: readonly Option<string>[] = [
  {value: 'formation', label: 'Formation', does: 'Where the symbol stands, its size and how many particles it gets.'},
  {value: 'force', label: 'Force', does: 'How the symbol pushes or pulls the particles around it.'},
  {value: 'sound', label: 'Sound', does: 'The symbol\'s voice.'},
  {value: 'meaning', label: 'Meaning', does: 'The centre of the body the symbol stands for, and how it colours the field.'},
]

function ExpressionTab(p: ClipProps) {
  const syms = symbolsOf(p.v), id = selected(p.v), sym = syms.find(s => s.id === id)
  if (!sym) return <Said>Select one symbol: its own controls show here.</Said>
  const page = choice(p.v, 'objPage', 'formation')
  const why = objBool(p.v, 'formation', 'locked') ? 'The symbol is locked. Unlock it on its Formation page.' : undefined
  const held = p.v['bp.bound'] === true && syms.slice(0, 6).some(s => s.id === id) ? 'A Blueprint holds this symbol. Use the Blueprint to move it.' : undefined
  const dial = (pg: string, key: string, label: string, does: string, min: number, max: number, def: number, format: (x: number) => string, opts: {log?: boolean; bipolar?: boolean; step?: number; off?: string} = {}) =>
    <Dial label={label} does={does} value={objNum(p.v, pg, key)} def={def} scale={{min, max, log: opts.log, step: opts.step}} format={format} bipolar={opts.bipolar} onChange={x => setObj(p, pg, key, x)} disabled={why ?? opts.off} />
  const box = (pg: string, key: string, label: string, does: string, min: number, max: number, def: number, format: (x: number) => string, off?: string) =>
    <ValueBox label={label} does={does} value={objNum(p.v, pg, key)} def={def} scale={{min, max, step: 0.01}} format={format} onChange={x => setObj(p, pg, key, x)} disabled={why ?? off} />
  const radio = (pg: string, key: string, label: string, does: string, options: readonly Option<string>[], stack = false) =>
    <Radio label={label} does={does} value={objStr(p.v, pg, key)} options={options} onChange={x => setObj(p, pg, key, x)} disabled={why} stack={stack} />
  const f2 = (x: number) => x.toFixed(2)
  return <div className="clv-pages">
    <div className="clv-pagebar">
      <Chooser label="Glyph" does="The selected symbol: its own controls show below." value={id ?? ''} options={syms.map(s => ({value: s.id, label: s.name}))} onChange={x => p.set('symbol', x)} />
      <Radio label="Page" does="The page of the selected symbol's controls." value={page} options={PAGES} onChange={x => p.set('objPage', x)} />
      {['Bind', 'Follow', 'Exact', 'Duplicate', 'Source'].map(act => <Action key={act} label={act} does={{
        Bind: 'Ties the symbol to a source.', Follow: 'Sets the symbol to follow another.', Exact: 'Gives the symbol an exact value.', Duplicate: 'Makes a copy of the symbol.', Source: 'Opens where the symbol came from.'}[act]}
        onPress={() => p.set(`act.${act.toLowerCase()}`, Date.now())} />)}
    </div>
    <div className="clv-sections">
      {page === 'formation' && <>
        <Section label="Place" cols={3}>
          {box('formation', 'x', 'X', 'Where the symbol stands, across.', -4, 4, 0, f2, held)}{box('formation', 'y', 'Y', 'Where the symbol stands, up and down.', -4, 4, 0, f2, held)}{box('formation', 'z', 'Z', 'Where the symbol stands, in depth.', -4, 4, 0, f2, held)}
          {box('formation', 'w', 'Width', 'The width of the symbol\'s box.', 0.01, 4, 0.65, f2, held)}{box('formation', 'h', 'Height', 'The height of the symbol\'s box.', 0.01, 4, 0.86, f2, held)}
        </Section>
        <Section label="Size" cols={2}>
          {dial('formation', 'scale', 'Scale', 'Scales the symbol about its centre.', 0.01, 10, 1, f2, {log: true, off: held})}
          {dial('formation', 'rotation', 'Rotation', 'Turns the symbol.', -360, 360, 0, x => `${Math.round(x)}°`, {bipolar: true, off: held})}
        </Section>
        <Section label="Particles" cols={2}>
          {dial('formation', 'share', 'Share', 'The weight of this formation when the particles are shared.', 0, 10, 1, f2)}
          {dial('formation', 'tint', 'Tint', 'How strongly the symbol shows its own colour.', 0, 1, 0, f2)}
        </Section>
        <Section label="Glyph" cols={2} grow>
          <div style={{gridColumn: 'span 2', width: '100%'}}><TextField label="Name" does="The name of the symbol." value={objStr(p.v, 'formation', 'name') || sym.name} onChange={x => setObj(p, 'formation', 'name', x)} disabled={why} wide /></div>
          <Toggle label="Enabled" does="An off symbol takes no particles and stays in the scene." on={objBool(p.v, 'formation', 'enabled')} onChange={x => setObj(p, 'formation', 'enabled', x)} disabled={why} />
          <Toggle label="Locked" does="A locked symbol refuses edits." on={objBool(p.v, 'formation', 'locked')} onChange={x => setObj(p, 'formation', 'locked', x)} />
          <div style={{gridColumn: 'span 2', width: '100%'}}><Said>Shape: {objStr(p.v, 'formation', 'shape') || '—'}. Change it in the glyph editor.</Said></div>
        </Section>
      </>}
      {page === 'force' && <>
        <Section label="Kind" width={90}>{radio('force', 'kind', 'Kind', 'The kind of force. None switches it off.', ['None', 'Attract', 'Repel', 'Vortex'].map(k => ({value: k.toLowerCase(), label: k})), true)}</Section>
        <Section label="Amount" cols={3}>
          {dial('force', 'strength', 'Strength', 'The amount of force. A negative value reverses it.', -20, 20, 0, f2, {bipolar: true})}
          {dial('force', 'spin', 'Spin', 'A whirl around the symbol. It works with any kind.', -20, 20, 0, f2, {bipolar: true})}
          {dial('force', 'radius', 'Radius', 'The reach of the force.', 20, 2000, 200, x => `${Math.round(x)} px`, {log: true})}
        </Section>
        <Section label="Centre" cols={3} grow>
          {box('force', 'cx', 'Centre X', 'Where the force acts, across. Drag the disc handle to pin it away from the symbol.', -4, 4, 0, f2)}
          {box('force', 'cy', 'Centre Y', 'Where the force acts, up and down.', -4, 4, 0, f2)}
          {box('force', 'cz', 'Centre Z', 'Where the force acts, in depth.', -4, 4, 0, f2)}
        </Section>
      </>}
      {page === 'sound' && <>
        <Section label="Voice" width={170}>
          <Toggle label="Voice" does="Lets the symbol carry part of the torus's sound to where it stands." on={objBool(p.v, 'sound', 'voice')} onChange={x => setObj(p, 'sound', 'voice', x)} disabled={why} />
          <Chooser label="Name or mode" does="What the voice carries of the torus's sound: a mode, or a name of the store of sound. It does not sound on its own." value={objStr(p.v, 'sound', 'carry')}
            options={read<Option<string>[]>(p.v, 'carryOptions', [{value: '', label: 'None yet'}])} onChange={x => setObj(p, 'sound', 'carry', x)} disabled={why} />
        </Section>
        <Section label="Level" width={90}>
          {dial('sound', 'gain', 'Gain', 'The loudness of the voice. 0 is silent.', 0, 1, 0.2, f2)}
        </Section>
        <Section label="Envelope" cols={2} grow>
          {dial('sound', 'attack', 'Attack', 'How long the voice takes to rise.', 0, 10, 0.08, secs)}
          {dial('sound', 'release', 'Release', 'How long the voice takes to fade.', 0, 30, 0.8, secs)}
          <div style={{gridColumn: 'span 2'}}><VoiceShape attack={objNum(p.v, 'sound', 'attack')} release={objNum(p.v, 'sound', 'release')} gain={objNum(p.v, 'sound', 'gain')} /></div>
        </Section>
      </>}
      {page === 'meaning' && <>
        <Section label="Centre" width={150}>
          <Chooser label="Meaning" does="The centre that the symbol stands for." value={objStr(p.v, 'meaning', 'centre')} onChange={x => setObj(p, 'meaning', 'centre', x)} disabled={why}
            options={['None', 'Root', 'Sacral', 'Solar plexus', 'Heart', 'Throat', 'Third eye', 'Crown'].map(c => ({value: c.toLowerCase(), label: c}))} />
          <Chooser label="Colour source" does="Where the colour of the centre comes from." value={objStr(p.v, 'meaning', 'source')} onChange={x => setObj(p, 'meaning', 'source', x)} disabled={why}
            options={['Canonical', 'Entity tint', 'Override'].map(c => ({value: c.toLowerCase(), label: c}))} />
          <Chooser label="Activation" does="What switches the centre on." value={objStr(p.v, 'meaning', 'activation')} onChange={x => setObj(p, 'meaning', 'activation', x)} disabled={why}
            options={['Constant', 'Live resonant affinity', 'Travelling focus'].map(c => ({value: c.toLowerCase(), label: c}))} />
        </Section>
        <Section label="Gains" cols={3}>
          {dial('meaning', 'colourGain', 'Colour', 'How strongly the centre colours the field.', 0, 100, 1, f2)}
          {dial('meaning', 'resonanceGain', 'Resonance', 'How strongly the centre answers the plate.', 0, 100, 1, f2)}
          {dial('meaning', 'globalGain', 'Scene', 'The colour gain for the whole scene.', 0, 100, 1, f2)}
        </Section>
        <Section label="Reach" cols={2}>
          {radio('meaning', 'radiusSource', 'Radius source', 'The reach of the colour: the force\'s radius, or its own.', [{value: 'force', label: 'Force'}, {value: 'own', label: 'Own'}])}
          {box('meaning', 'radius', 'Radius', 'The reach when Radius source is its own.', 1, 100000, 220, x => `${Math.round(x)} px`, objStr(p.v, 'meaning', 'radiusSource') === 'own' ? undefined : 'Set Radius source to its own first.')}
          {radio('meaning', 'falloff', 'Falloff', 'How the colour fades with distance.', [{value: 'gaussian', label: 'Gaussian'}, {value: 'compact', label: 'Compact'}])}
          {radio('meaning', 'metric', 'Metric', 'How distance is measured.', [{value: 'plane', label: 'Plane'}, {value: 'world', label: 'World 3D'}])}
        </Section>
        <Section label="Mix" grow>
          {radio('meaning', 'blend', 'Blend', 'How the colours of several centres mix. Weighted does not depend on order.', [{value: 'weighted', label: 'Weighted'}, {value: 'additive', label: 'Additive'}])}
          <Said>Modulations: {objStr(p.v, 'meaning', 'modulations') || 'none'}.</Said>
        </Section>
      </>}
    </div>
  </div>
}

/** The voice's shape: it rises over its attack to its gain, holds, and fades over its release. */
function VoiceShape({attack, release, gain}: {attack: number; release: number; gain: number}) {
  const w = 200, h = 64
  if (!Number.isFinite(attack) || !Number.isFinite(release) || !Number.isFinite(gain)) return <Display w={w} h={h} label="Voice" corner="—">{null}</Display>
  const total = attack + release + Math.max(1, (attack + release) * 0.6), x = (t: number) => 6 + t / total * (w - 12), y = (g: number) => h - 8 - g * (h - 16)
  const d = `M${x(0)} ${y(0)} L${x(attack)} ${y(gain)} L${x(total - release)} ${y(gain)} L${x(total)} ${y(0)}`
  return <Display w={w} h={h} label="Voice" does="The voice's shape: it rises over its attack to its gain, holds, and fades over its release." corner={`${gain.toFixed(2)}`}>
    <path d={`${d} Z`} className="dp-fill" /><path d={d} className="dp-curve" />
  </Display>
}

function SoundTab(p: ClipProps) {
  const syms = symbolsOf(p.v), objects = objectsOf(p.v), end = sceneEnd(p.v)
  const voiced = syms.filter(s => objects[s.id]?.sound?.voice === true)
  const lanes: Lane[] = voiced.map(s => ({id: s.id, label: s.name, key: 'name', marked: true}))
  const blocks: Block[] = voiced.map(s => {
    const snd = objects[s.id]!.sound!
    return {id: s.id, lane: s.id, at: Number(snd.attack ?? 0), len: Math.max(0.1, end - Number(snd.attack ?? 0) - Number(snd.release ?? 0)), glide: Number(snd.release ?? 0),
      label: snd.follow === true ? `follows the plate · gain ${Number(snd.gain).toFixed(2)}` : `${snd.frequency} Hz · gain ${Number(snd.gain).toFixed(2)} · ${snd.wave}`, tone: 'green' as const,
      does: `${s.name}'s voice: it rises over its attack, holds, and fades over its release.`}
  })
  const underH = Math.max(60, Math.round(p.room.h * 0.4))
  return <LaneGrid lanes={lanes} blocks={blocks} from={0} to={end} major={1} minor={0.5} label={t => `${t}`} keyW={72} laneH={Math.max(18, Math.min(32, Math.floor((p.room.h - 16 - underH) / Math.max(1, lanes.length))))}
    w={p.room.w} h={p.room.h} name="Sound" does="The scene's sound at full height: each voice, as it rises, holds and fades, and the plate's pitch under them."
    under={<SoundUnder p={p} from={0} to={end} h={underH} />} underH={underH} />
}

const seqBar = (p: ClipProps) => <>
  <Toggle label="Fold" does="Keeps only the lanes of the symbols that change in the scene." on={p.v.fold === true} onChange={x => p.set('fold', x)} />
  <Toggle label="Voices" does="Highlights the lanes of the symbols that have a voice." on={p.v.highlight === true} tone="value" onChange={x => p.set('highlight', x)} />
  <Toggle label="Loop" does="Loops the scene between its start and the end of its hold." on={p.v.loopScene === true} onChange={x => p.set('loopScene', x)} />
</>

// ---------------------------------------------------------------- the fixtures

const SYMBOLS: Glyph[] = [
  {id: 'sun', name: 'Sun', steps: [{at: 0, hold: 2, glide: 1, state: 'seed'}, {at: 3, hold: 2.5, glide: 1, state: 'bloom'}, {at: 6.5, hold: 1.5, glide: 2, state: 'crown'}]},
  {id: 'moon', name: 'Moon', steps: [{at: 0.5, hold: 3, glide: 1.5, state: 'crescent'}, {at: 5, hold: 3, glide: 2, state: 'full'}]},
  {id: 'tree', name: 'Tree', steps: [{at: 1, hold: 4, glide: 2, state: 'root'}, {at: 7, hold: 1, glide: 2, state: 'leaf'}]},
  {id: 'river', name: 'River', steps: [{at: 0, hold: 8, glide: 2, state: 'flow'}]},
  {id: 'eye', name: 'Eye', steps: [{at: 4, hold: 2, glide: 1, state: 'open'}]},
  {id: 'hand', name: 'Hand', steps: []},
]
const obj = (x: number, y: number, extra: Obj = {}): Obj => ({
  formation: {x, y, z: 0, w: 0.65, h: 0.86, scale: 1, rotation: 0, share: 1, tint: 0, enabled: true, locked: false, shape: 'glyph · ring of 160 points'},
  force: {kind: 'attract', strength: 0, spin: 0, radius: 200, cx: x, cy: y, cz: 0},
  sound: {voice: false, follow: true, frequency: 220, gain: 0.2, wave: 'sine', attack: 0.08, release: 0.8, pan: 0},
  meaning: {centre: 'none', source: 'canonical', activation: 'constant', colourGain: 1, resonanceGain: 1, globalGain: 1, radiusSource: 'force', radius: 220, falloff: 'gaussian', metric: 'plane', blend: 'weighted', modulations: ''},
  ...extra,
})
const OBJECTS: Record<string, Obj> = {
  sun: obj(0, 0.4, {force: {kind: 'attract', strength: 5, spin: 3, radius: 640, cx: 0, cy: 0.4, cz: 0}, sound: {voice: true, follow: false, frequency: 330, gain: 0.3, wave: 'sine', attack: 2, release: 1.5, pan: 0},
    meaning: {centre: 'solar plexus', source: 'canonical', activation: 'live resonant affinity', colourGain: 4, resonanceGain: 2, globalGain: 1, radiusSource: 'force', radius: 220, falloff: 'gaussian', metric: 'plane', blend: 'weighted', modulations: 'force strength → colour gain, 40'}}),
  moon: obj(-1.2, 0.8, {sound: {voice: true, follow: true, frequency: 220, gain: 0.2, wave: 'triangle', attack: 1, release: 2, pan: -0.6}}),
  tree: obj(1.1, -0.6), river: obj(0, -1.4), eye: obj(-0.6, -0.2), hand: obj(0.8, 0.9),
}
const LANES: AutoLane[] = [
  {id: 'l1', device: 'Physics', target: 'Viscosity', type: 'oscillator', wave: 'sine', rate: 0.25, phase: 0, min: 0.2, max: 0.8, blend: 'replace', duration: 4, delay: 0, loop: 'loop', easing: 'smooth', enabled: true},
  {id: 'l2', device: 'Colour', target: 'Hue phase', type: 'ramp', wave: 'sine', rate: 0.5, phase: 0, min: 0, max: 1, blend: 'add', duration: 6, delay: 1, loop: 'once', easing: 'ease in', enabled: true},
  {id: 'l3', device: 'sun', target: 'Force strength', type: 'oscillator', wave: 'triangle', rate: 0.5, phase: 0.25, min: 2, max: 8, blend: 'multiply', duration: 4, delay: 0, loop: 'loop', easing: 'smooth', enabled: true},
  {id: 'l4', device: 'Colour', target: 'Glow', type: 'oscillator', wave: 'sine', rate: 0.5, phase: 0, min: 10, max: 60, blend: 'replace', duration: 4, delay: 0, loop: 'loop', easing: 'smooth', enabled: true, follows: 'l1'},
]
const PLATE = [[0, 110], [2, 147], [3, 220], [5, 330], [6.5, 440], [8, 330], [10, 220]]
const LAYERS: Layer[] = [{id: 't1', visible: true, heading: 'A moment in the field', title: 'Dawn swell', italic: 'the sun before the word', body: '', size: 42, width: 260, x: 0.07, y: 0.18, align: 'left'}]
const TRIGGERS: Trigger[] = [
  {name: 'to-night', occasion: 'Scene leaves', target: 'Jump to a scene', placement: 'Beside', operation: 'Inspect'},
  {name: 'open-day', occasion: 'Activated', target: 'Open a portal', placement: 'Beside', operation: 'Inspect'},
]
const SCENES = [{id: 'dawn', name: 'Dawn swell'}, {id: 'noon', name: 'Noon field'}, {id: 'night', name: 'Night'}]

export const clip: DesignedClip = {
  id: 'clip:expressions',
  mode: 'expressions',
  title: 'An Expressions scene',
  head: {name: 'name', colour: 'colour', active: 'active'},
  defaults: {
    name: 'Dawn swell', colour: 'var(--honey)', active: true, duration: 8, transition: 2, signature: '5:3', start: 0, locked: false,
    madeOf: 'The day\'s turning', 'madeOf.ref': 'wiki:anchor:days-turning',
    carrier: 'text source', presentation: 'inline', reference: 'Control/user/day/2026-10-16/day.md', 'span.from': 0, 'span.to': 0,
    quantize: 'global', follow: 'jump', jumpTo: 'night', scenes: JSON.stringify(SCENES), triggers: JSON.stringify(TRIGGERS), trigger: 'to-night',
    tool: 'select', layers: JSON.stringify(LAYERS), layer: 't1', 'bp.bound': true, 'bp.x': 0, 'bp.y': 0.1, 'bp.z': 0, 'bp.rx': 0, 'bp.ry': 0, 'bp.rz': 12, 'bp.size': 1.2,
    'ar.objects': 'sun,moon,tree', 'ar.rule': 'ring', 'ar.plane': 'XY',
    symbols: JSON.stringify(SYMBOLS), objects: JSON.stringify(OBJECTS), symbol: 'sun', objPage: 'force', lanes: JSON.stringify(LANES), plate: JSON.stringify(PLATE),
    fold: false, highlight: true, loopScene: false,
    'view.panel': 'clip', 'view.tools': 'pointer', 'view.editor': 'sequence',
  },
  fixtures: {
    'A scene': {},
    'Its automation': {'view.editor': 'envelopes', 'view.panel': 'launch', 'view.tools': 'text', 'env.device': 'Physics'},
    'The Sun\'s voice': {'view.editor': 'expression', objPage: 'sound', 'view.tools': 'blueprint'},
    'Arranging': {'view.tools': 'arrange', fold: true, 'view.editor': 'sound', locked: true},
    'No readings': {symbols: undefined, objects: undefined, lanes: undefined, plate: undefined, layers: undefined, triggers: undefined, scenes: undefined, duration: undefined, transition: undefined, start: undefined},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'The scene\'s name, colour, length, transition, signature, start and lock, and what it carries as its body.', draw: ClipPanel},
    {id: 'launch', label: 'Launch', does: 'When the scene\'s launch lands, what comes after it, and its triggers.', draw: LaunchPanel},
  ],
  tools: [
    {id: 'pointer', label: 'Pointer', does: 'What the pointer does in the field: select, orbit, form or bind.', draw: PointerTool},
    {id: 'text', label: 'Text', does: 'Words on the page of the scene.', draw: TextTool},
    {id: 'blueprint', label: 'Blueprint', does: 'Six symbols tied into a sixfold figure that moves as one.', draw: BlueprintTool},
    {id: 'arrange', label: 'Arrange', does: 'Sets the positions of chosen symbols by a rule.', draw: ArrangeTool},
  ],
  editor: [
    {id: 'sequence', label: 'Sequence', does: 'One lane for each symbol, its states as steps with hold and glide, and the sound beneath.', draw: Sequence, bar: seqBar},
    {id: 'envelopes', label: 'Envelopes', does: 'The scene\'s automation: lanes that move a field or symbol parameter over the scene.', draw: Envelopes},
    {id: 'expression', label: 'Expression', does: 'The selected symbol\'s own controls: Formation, Force, Sound and Meaning.', draw: ExpressionTab},
    {id: 'sound', label: 'Sound', does: 'The scene\'s sound at full height: the voices and the plate.', draw: SoundTab, bar: seqBar},
  ],
}
