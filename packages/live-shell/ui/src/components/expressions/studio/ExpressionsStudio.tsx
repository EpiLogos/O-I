// The Expressions Studio on the Device side (DLW §16.2 Expressions: "The Studio: the field, then its field devices"; §20.3 Studio "the rack
// of an Expression. Its macros are the controls you choose to play … Its chains hold the devices that shape the field"; lock §0.3.7; R4).
// The Studio is the catalogue's design (`expressions:studio`, inhabitants/catalogue/panels/expressions__studio.tsx, 9e57d8fe0) drawn by the
// one device runtime on the Expression's own record (studioBinding.ts): your chosen controls as its macros, the field devices in four
// chains, Save, Undo and Redo in its head. Published on the door, so the chain, the pool, the expanded band, a pane and the rail draw the
// same Studio on the same binding. It replaces the eight-section plate this module drew (Tools, Selected, Formation, Material, Motion,
// Body · 3:3, Nara · M4, Capture, then Your controls) — that plate's parts went where the manual puts them:
//   • the macros are your chosen controls (Your controls, components/NativeChosenControls.tsx, is the Studio's Macros page now); the
//     field devices stand in the chains, each with its light, On, Show (whole in the pool) and Pane (full in a pane) — the devices the
//     sections drew are the same runtime devices (useFieldDevices publishes them; the Body's Quaternal Logic faces through qlFaceEntry);
//   • the pointer's tools, the selected symbol (Object, its Force, its Glyph sequence) and Formation's scene devices are the scene's Clip
//     view's (§20.1, lock §0.3.7): SelectedObject and SelectedSequence stay exported here for it; Capture is the transport's;
//   • the stage's own controls the manual gives no home — the view (camera, guides, snap), still and video capture, Present and Edition
//     (export, import) — and the frame's pointer and scene tools until Clip view draws them stand beside the Studio as the Stage, the same
//     controls through the same runner (StudioStage.tsx, frameChrome.tsx), never inside the Studio's design;
//   • Configure (the settings: your rack, chosen controls, macros, the Scene), Deep edit, Read again, Reopen and Copy address stand as the
//     Studio's head marks; a device dragged from the browser goes on the rack, a parameter dragged from the browser becomes a macro.
// Every write leaves through the owner path it used before: the retained editor's one request, the device's own submit, the stage's runner.
import {useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode} from 'react'
import {addressLink} from '@epilogos/expressions-boundary'
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeEditorRequest, NativeSequenceSettings} from '@epilogos/expressions-boundary/editor'
import {InstrumentPlate, type PlateSection} from '../../../frame/devices/InstrumentPlate'
import {OwnerValueBox, PlateRadio, PlateReading} from '../../../frame/devices/plateControls'
import {DeviceView} from '../../../frame/devices/DeviceView'
import type {DeviceInstance} from '../../../frame/devices/deviceRuntime'
import {Action} from '../../../inhabitants/sdk/panel'
import {flipDevice, holdInBand, publishDevice, selectDevice} from '../../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../../frame/devices/devicePane'
import {openInstrument} from '../../../frame/instrumentDoor'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {PlateMark} from '../../../inhabitants/sdk/controls'
import type {IconName} from '../../../inhabitants/sdk/icons'
import {inhabitantManifest} from '../../../inhabitants/manifest'
import {QUATERNAL_LOGIC_FAMILY_ID} from '../../../inhabitants/worldShellFamilies'
import {qlFaceEntry} from '../../../inhabitants/ql/devices/TechneDevices'
import {useLiveTorusReading, useQlInstrumentFeed} from '../../../live/torusInstrument'
import {expressionsDeviceId} from '../../devices/expressionsDevice'
import {openFieldDeviceFull, useEditorApply, useFieldDevices} from '../../devices/ExpressionsDeviceView'
import {useFieldInstrument} from '../../devices/useFieldInstrument'
import {forceStripDevice, selectedEntity} from '../../nativeDeviceStripModel'
import {DEVICE_MIME, PARAMETER_BROWSE_EVENT, activeDrag, afterIdFor, dispatchOpenDevice, parseDeviceDrag} from '../../nativeDrag'
import {chosenAddChange, chosenDropReason} from '../../nativeBrowserModel'
import type {RetainedGlyphInput} from '../../GlyphSequenceEditor'
import {STUDIO_CARRIED, studioChains, studioFieldFamilies, studioOwner, studioPlace, studioSections} from './studioModel'
import {STUDIO_DEVICE_ID, studioBinding, type StudioNara} from './studioBinding'
import {StageCaptureTools, StageViewTools, useStageSender} from './StudioStage'
import {FrameControls, controlsAt, useFrameChromeOver} from './frameChrome'
import {useFramePlacement, useHostedChrome} from '../../../projections/expressionsPaneHost'
import './studio.css'

type Request = (request: NativeEditorRequest) => Promise<NativeEditorReply>

export interface ExpressionsStudioProps {
  reading: NativeEditorReading | null
  request: Request
  /** Choose the object the selected symbol's controls act on (the owner's `select`): Clip view's now (SelectedObject). */
  selectEntity: (id: string) => void
  /** The compact glyph editor's custody (the detail still hands it). */
  drafts: Map<string, RetainedGlyphInput>
  /** Open the selected formation's glyph clip (Clip view › States, deep). */
  onExpandGlyph: () => void
  glyphPresented: () => boolean
  /** The settings (Configure): when open, they stand in place of the Studio. */
  configure: boolean
  onConfigure: () => void
  settings: readonly PlateSection[]
  /** The person's own controls while they hold any: the macros of their racks stand after the Studio (their chosen controls are the
   * Studio's macros, so `chosen` is not drawn twice). */
  own: readonly PlateSection[]
  /** Deep edit: the Studio full height, and Return. */
  deep: {open: boolean; available: boolean; onPress: () => void}
  /** Read the retained editor again (the old header's ↻). */
  refresh: {available: boolean; onPress: () => void}
  /** The owner's refusal of the last request, in its words. */
  fault: string | null
}

const SECTIONS = studioSections()
const FIELD_FAMILIES = studioFieldFamilies(SECTIONS)
/** The Quaternal Logic faces the Body chain holds (semantics.ts STUDIO_SECTIONS studio:body). */
const BODY_QL = SECTIONS.flatMap(section => section.ql)
/** A Body face's name in the chain: the manual's for the torus (§20.3 "Physics, Resonance, Torus"), the face's own title else. */
const qlTitle = (faceId: string, title: string) => (faceId === 'torus' ? 'Torus' : title)

/** The Studio as a device of the runtime: the Expression's rack (lock §1 Rack: parallel chains under one device, a chain selector), drawn by
 * its design. Its values are the binding's. */
export const STUDIO_DEVICE: DeviceInstance = {
  id: STUDIO_DEVICE_ID, family: 'expressions', rows: [], values: {},
  face: {id: 'studio', title: 'Studio', icon: 'expr', liveSemantic: 'rack',
    invariant: {chains: ['Material', 'Motion', 'Body', 'Nara'], chainSelector: 'chain (Chains page: the four chains with their lights)'},
    note: 'The rack of an Expression (DLW §20.3): your chosen controls as its macros, the field devices in four chains.'},
}

/** One head mark of the Studio (the place's own acts, before ⤢). */
function Mark({icon, label, onPress}: {icon: IconName; label: string; onPress: () => void}) {
  return <button type="button" className="dp-full" data-studio-mark={icon} aria-label={label} title={label} data-i={`${label.split(':')[0]}|${label}.`} onClick={onPress}>
    <Icon name={icon} size={10} />
  </button>
}

export function ExpressionsStudio(props: ExpressionsStudioProps) {
  // The selected symbol and its glyph clip (selectEntity, onExpandGlyph, drafts, glyphPresented) are the scene's Clip view's now.
  const {reading, request, configure, onConfigure, settings, own, deep, refresh, fault} = props
  const editor = useEditorApply(reading, request)
  // The field devices stand published on the door (the same devices the rack, the pool and a pane show): the chains' Show and Pane reach
  // them there. The Field stands at their head over the same devices (§20.3: your controls, then the Field, then each chain).
  const fieldDevices = useFieldDevices(FIELD_FAMILIES, {reading, apply: editor.apply, captureCurrent: editor.captureCurrent, locked: editor.locked})
  useFieldInstrument(fieldDevices, {reading, apply: editor.apply, locked: editor.locked})
  const [paneFault, setPaneFault] = useState<string | null>(null)
  const torus = useLiveTorusReading()
  const instrumentReading = useQlInstrumentFeed()
  const qlFaces = inhabitantManifest(QUATERNAL_LOGIC_FAMILY_ID)?.faces ?? []
  const qlEntries = useMemo(() => BODY_QL.flatMap(id => { const face = qlFaces.find(item => item.id === id); return face ? [qlFaceEntry(face, torus, instrumentReading)] : [] }),
    [qlFaces, torus, instrumentReading])
  // The stage's controls read the frame's chrome by value and send through its one runner.
  const chrome = useHostedChrome()
  const stage = useStageSender(chrome?.state ?? null, chrome?.run ?? null)
  const frame = useFrameChromeOver(chrome?.state ?? null, chrome?.run ?? null)
  const frameAt = (homes: Parameters<typeof controlsAt>[1]) => controlsAt(frame.reading, homes, STUDIO_CARRIED)
  const placement = useFramePlacement()
  const hosted = chrome?.state ?? null
  const place = studioPlace(hosted)
  const link = hosted?.address ? addressLink(hosted.nativeScene?.expression_ref ?? hosted.document?.id, hosted.address) : null
  const [copyNote, setCopyNote] = useState<string | null>(null)
  useEffect(() => {if (!copyNote) return; const timer = setTimeout(() => setCopyNote(null), 4000); return () => clearTimeout(timer)}, [copyNote])
  const copyAddress = () => {
    if (!link) return
    // The clipboard write of RunPage.tsx:163: its answer, or its refusal, in one line.
    if (!navigator.clipboard) {setCopyNote('This window offers no clipboard; the address is in the link mark\'s words.'); return}
    void navigator.clipboard.writeText(link).then(() => setCopyNote(`Address copied: ${link}`), () => setCopyNote('The clipboard refused the address.'))
  }

  // Nara: the frame's own Nara control (naraInstrument.tsx :307), its pressed state the instrument open over the field.
  const naraControl = controlsAt(frame.reading, 'nara').find(control => control.kind === 'toggle' || control.kind === 'button') ?? null
  const naraPressed = naraControl?.kind === 'toggle' ? !!naraControl.pressed : undefined
  const naraWhy = !naraControl ? frame.reason ?? 'The frame publishes no Nara control here.' : frame.reason ?? (naraControl.disabled ? `${naraControl.label} is off here.` : undefined)
  const nara: StudioNara = useMemo(() => ({...(naraPressed !== undefined ? {pressed: naraPressed} : {}), ...(naraWhy ? {why: naraWhy} : {})}), [naraPressed, naraWhy])
  const chains = useMemo(() => studioChains(qlFaces, id => qlTitle(id, qlEntries.find(entry => entry.face.id === id)?.device.face.title ?? id), SECTIONS),
    // the faces are the family's, read once per admission; the titles follow them
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qlFaces])
  const browse = useCallback(() => window.dispatchEvent(new CustomEvent(PARAMETER_BROWSE_EVENT)), [])
  const show = (family: string) => {
    const ql = qlEntries.find(entry => entry.face.id === family)
    if (ql) holdInBand(ql.device.id, {device: ql.device, picture: ql.picture, ...(ql.binding ? {binding: ql.binding} : {})})
    else if (family !== 'nara') { selectDevice(expressionsDeviceId(family)); flipDevice(expressionsDeviceId(family)) }
  }
  const pane = (family: string) => {
    const ql = qlEntries.find(entry => entry.face.id === family)
    if (ql) {
      publishDevice(ql.device.id, {device: ql.device, picture: ql.picture, ...(ql.binding ? {binding: ql.binding} : {})})
      try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: ql.device.id, title: ql.device.face.title}); setPaneFault(null) }
      catch (cause) { setPaneFault(cause instanceof Error ? cause.message : String(cause)) }
      return
    }
    const row = chains.flatMap(holding => holding.field).find(device => device.family === family)
    if (row) setPaneFault(openFieldDeviceFull(family, row.name))
  }
  // The ports read the place as it stands at each press; the binding is rebuilt only when what it reads changes.
  const latest = useRef({show, pane, nara: naraControl ? () => frame.send(naraControl) : null})
  latest.current = {show, pane, nara: naraControl ? () => frame.send(naraControl) : null}
  const naraOn = !!naraControl && !naraWhy
  const binding = useMemo(() => studioBinding({reading, chains, nara}, {request, browse,
    show: family => latest.current.show(family), pane: family => latest.current.pane(family), nara: naraOn ? () => latest.current.nara?.() : null}),
  [reading, chains, nara, request, browse, naraOn])
  useEffect(() => { publishDevice(STUDIO_DEVICE_ID, {device: STUDIO_DEVICE, binding}) }, [binding])
  useEffect(() => () => publishDevice(STUDIO_DEVICE_ID, null), [])

  // The place's own acts in the Studio's head.
  const marks = <>
    <Mark icon="cmd" label={configure ? 'Close the settings' : 'Configure: your rack, chosen controls, macros and the Scene'} onPress={onConfigure} />
    {deep.available && <Mark icon="dock" label={deep.open ? 'Return the Studio to its place' : 'Deep edit: the Studio at full height'} onPress={deep.onPress} />}
    {refresh.available && <Mark icon="orbit" label="Read the retained editor again" onPress={refresh.onPress} />}
    {chrome?.reopen && <Mark icon="orbit" label="Reopen the native work: the frame's host is gone" onPress={chrome.reopen} />}
    {link && <Mark icon="link" label={`Copy address: ${link}`} onPress={copyAddress} />}
  </>

  // A device dragged from the browser goes on the rack, appended after the last widget (the rack's own drop, one device-add); a parameter
  // dragged from the browser becomes one of your macros (the chosen controls' own drop, NativeChosenControls.tsx:131-143).
  const [dropping, setDropping] = useState<string | null>(null)
  const dropKind = (event: DragEvent<HTMLElement>): 'device' | 'parameter' | null => {
    if (event.defaultPrevented || !reading || editor.locked) return null
    if (event.dataTransfer.types.includes(DEVICE_MIME)) return 'device'
    return activeDrag()?.kind === 'parameter' ? 'parameter' : null
  }
  const onDrop = (event: DragEvent<HTMLElement>) => {
    setDropping(null)
    const kind = dropKind(event)
    if (!kind || !reading) return
    event.preventDefault()
    if (kind === 'device') {
      const family = parseDeviceDrag(event.dataTransfer.getData(DEVICE_MIME))
      if (family) void editor.apply([{kind: 'device-add', family, after_id: afterIdFor(reading.devices.length, reading.devices.map(device => device.id))}])
      return
    }
    const active = activeDrag()
    if (active?.kind !== 'parameter') return
    const reason = chosenDropReason(active.drag, reading)
    if (reason) { setPaneFault(reason); return }
    void editor.apply([chosenAddChange(active.drag)])
  }

  // The Stage: the stage's own controls the manual gives no home yet, and the frame's pointer and scene tools until Clip view draws them;
  // then the person's macro racks while held. Never inside the Studio's design.
  const frameTools = frameAt(['tools', 'scene', 'side'])
  const stageSections: PlateSection[] = [
    ...(frameTools.length ? [{id: 'stage:frame', title: 'Frame tools', children: <FrameControls label="Frame tools" controls={frameTools} view={frame} />}] : []),
    {id: 'stage:view', title: 'View', children: <StageViewTools sender={stage} />},
    {id: 'stage:capture', title: 'Capture', children: <StageCaptureTools sender={stage} />},
    ...own.filter(section => section.id !== 'chosen'),
  ]
  const said = [fault ?? paneFault ?? editor.error, stage.refusal, frame.refusal, ...(placement === null ? chrome?.faults ?? [] : [])].filter((text): text is string => !!text)
  const footer: ReactNode = said.length || copyNote ? <>
    {said.length > 0 && <p className="studio-fault" role="alert">{said.join(' · ')}</p>}
    {copyNote && <p className="studio-note" role="status">{copyNote}</p>}
  </> : undefined
  const closeSettings: {icon: PlateMark; label: string; onPress: () => void}[] = [{icon: 'cmd', label: 'Close the settings', onPress: onConfigure}]

  if (configure) {
    return <InstrumentPlate presentation={{family: 'expressions', faceId: 'studio', title: 'Studio · settings', icon: 'expr', owner: studioOwner(reading, place)}}
      actions={closeSettings} sections={[...settings]} bodyClassName="native-device-view" dataAttributes={{'data-studio': 'settings'}} footer={footer} />
  }
  return <div className="expressions-studio" data-studio="rack" data-dropping={dropping ?? undefined} data-dirty={reading?.standing.dirty ? 'true' : undefined}
    onDragOver={event => { const kind = dropKind(event); if (!kind) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDropping(kind) }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(null) }}
    onDrop={onDrop}>
    <div className="expressions-studio-slot" data-device={STUDIO_DEVICE_ID} data-design="expressions:studio">
      <DeviceView device={STUDIO_DEVICE} size="compact" binding={binding} marks={marks} actions={[
        {icon: 'detail', label: 'Select the Studio: the keys and the status bar speak to it; its expanded view holds its Macros and Chains above the chain', onPress: () => selectDevice(STUDIO_DEVICE_ID)},
        {icon: 'pane', label: 'Open the Studio full in a pane', onPress: () => { try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: STUDIO_DEVICE_ID, title: 'Studio'}) } catch (cause) { setPaneFault(cause instanceof Error ? cause.message : String(cause)) } }},
      ]} />
    </div>
    <InstrumentPlate presentation={{family: 'expressions', faceId: 'stage', title: 'Stage', icon: 'expr', owner: studioOwner(reading, place)}}
      sections={stageSections} bodyClassName="native-device-view" dataAttributes={{'data-studio-stage': 'unplaced'}} footer={footer} />
  </div>
}

/** The one formation the selected symbol's Glyph page acts on: the selected object, when it is a formation. */
export function selectedFormation(reading: NativeEditorReading | null) {
  return reading ? reading.scene.entities.find(item => item.kind === 'formation' && reading.selection.entity_ids.length === 1 && reading.selection.entity_ids[0] === item.id) ?? null : null
}

const FORCE_MODES = ['none', 'attract', 'repel', 'vortex'] as const

/** The selected symbol: which object the scene's editor acts on, and what it does to it — the Force card's modes and its reading. It stood
 * in the Studio's Selected section; it is the scene's Clip view's now (DLW §20.1; lock §0.3.7), kept here for it to mount. */
export function SelectedObject({reading, selectEntity, locked, send}: {reading: NativeEditorReading | null; selectEntity: (id: string) => void
  locked: boolean; send: (changes: NativeEditorChange[]) => void}) {
  const entity = reading ? selectedEntity(reading) : null
  const force = reading ? forceStripDevice(reading) : null
  return <div className="studio-selected">
    <label className="studio-chooser" data-i="Object|The object the scene's editor acts on.">
      <span className="dp-label">Object</span>
      <select className="dp-chooser" aria-label="Native editor selection" value={reading?.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : ''}
        disabled={!reading || reading.standing.pending} onChange={event => selectEntity(event.target.value)}>
        <option value="">{reading ? 'Choose an object' : 'No work is open'}</option>
        {reading?.scene.entities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {force && entity
      ? <div className="studio-force" role="group" aria-label={force.name}>
          <div className="studio-row-head">
            <span role="img" className={`sdk-power sdk-power--${force.on === undefined ? 'unknown' : force.on ? 'on' : 'off'}`}
              aria-label={`${force.name} ${force.on === undefined ? 'unknown' : force.on ? 'on' : 'off'}`} title={`${force.name}: the object's own reading`} />
            <button type="button" className="studio-row-name" title="Open settings" onClick={() => dispatchOpenDevice({scope: 'entity', family: 'force'})}>{force.name}</button>
          </div>
          <div className="studio-toggle" role="group" aria-label="Force mode">{FORCE_MODES.map(mode => <button key={mode} type="button"
            aria-pressed={entity.force.kind === mode} disabled={locked || entity.locked}
            onClick={() => send([{kind: 'force-mode', entity_id: entity.id, value: mode}])}>{mode}</button>)}</div>
          <p className="studio-summary" title={force.summary} data-i={`${force.name}|${force.summary}`}>{force.summary}</p>
        </div>
      : <p className="inst-section-line">{reading ? 'Choose one object to act on it.' : 'Open a native Expression to act on its objects.'}</p>}
  </div>
}

const COMPOSE = [{value: 'hold', label: 'Hold', does: 'Hold the selected state.'}, {value: 'manual', label: 'Manual', does: 'Blend the states by hand.'},
  {value: 'play', label: 'Play', does: 'Play the sequence.'}] as const
const CLOCKS = [{value: 'seconds', label: 'Seconds', does: 'The states run on seconds.'}, {value: 'morph', label: 'Morph', does: 'The states run on the field\'s morph cycles.'}] as const
const ORDERS = [{value: 'loop', label: 'Loop', does: 'The states run in order and loop.'}, {value: 'pingpong', label: 'Ping-pong', does: 'There and back.'},
  {value: 'random', label: 'Random', does: 'A deterministic random order.'}] as const
const RATE = {min: -100, max: 100, step: 0.01}, PHASE = {min: -1000, max: 1000, step: 0.01}
const twoPlaces = (value: number) => `${+value.toFixed(2)}`

/** The selected formation's glyph sequence as kit controls — how it composes, its clock, its order, its rate and phase — each one
 * `sequence-settings` change through the one apply (ported from GlyphSequenceEditor.tsx:149 `settings` and its top controls :296-301). It
 * stood on the Studio's Selected section's Glyph page; it is the scene's Clip view's now (the selected symbol's Formation, lock §0.3.7). */
export function SelectedSequence({reading, formation, locked, apply, onExpand}: {reading: NativeEditorReading | null; formation: ReturnType<typeof selectedFormation>
  locked: boolean; apply: (changes: NativeEditorChange[]) => void; onExpand: () => void}) {
  if (!reading || !formation) return <p className="inst-section-line" data-i="|Select a native formation to set its glyph sequence.">Select a native formation to set its glyph sequence.</p>
  const sequence = formation.sequence
  const step = sequence.steps.find(item => item.id === reading.selection.step_id) ?? sequence.steps[0]
  const off = locked || formation.locked || reading.standing.pending ? (formation.locked ? `${formation.name} is locked.` : 'Waiting for the native owner to acknowledge the last change.') : undefined
  const settings = (values: NativeSequenceSettings) => apply([{kind: 'sequence-settings', entity_id: formation.id, ...(step ? {step_id: step.id} : {}), values}])
  const compose = sequence.enabled ? 'play' : sequence.manual ? 'manual' : 'hold'
  return <div className="studio-sequence" role="group" aria-label={`Glyph sequence of ${formation.name}`}>
    <PlateRadio label="Compose" does="How the sequence composes: hold a state, blend by hand, or play." value={compose} options={COMPOSE} stack disabled={off}
      onChange={value => settings({enabled: value === 'play', manual: value === 'manual'})} />
    <div className="studio-sequence-col">
      <PlateRadio label="Clock" does="What the states run on." value={sequence.clock} options={CLOCKS} stack disabled={off} onChange={clock => settings({clock})} />
    </div>
    <div className="studio-sequence-col">
      <PlateRadio label="Order" does="The order the states run in." value={sequence.order ?? 'loop'} options={ORDERS} stack disabled={off} onChange={order => settings({order})} />
    </div>
    <div className="studio-sequence-col">
      <OwnerValueBox label="Rate" does="The sequence's rate, times its clock." value={sequence.rateMul ?? 1} def={1} scale={RATE} format={twoPlaces} why={off} onCommit={rateMul => settings({rateMul})} />
      <OwnerValueBox label="Phase" does="Where the sequence starts, in cycles." value={sequence.phaseOffset ?? 0} def={0} scale={PHASE} format={twoPlaces} why={off} onCommit={phaseOffset => settings({phaseOffset})} />
      <PlateReading label="States" value={sequence.steps.length} does="The states of the sequence. Open them in the clip." />
      <Action label="States ⤢" does="Open the glyph clip: its states, their timing and their sources." onPress={onExpand} />
    </div>
  </div>
}
