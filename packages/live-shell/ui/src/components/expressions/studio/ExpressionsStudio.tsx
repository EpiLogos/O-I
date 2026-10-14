// The Expressions Studio on the Device side (manual §3: "In Expressions it is the studio that shapes the field"; §7: "The studio sits
// in the device area: the field's tools; what you can do with the symbol you have selected …; then formation, material, motion, the body
// of the field, a personal layer that stays yours however the scene is shared, and capture. Behind the studio stand the devices that
// govern the field itself … each a whole device with every setting it needs"; lock §2.4 Device = Studio; the mockup's Studio at
// world-shell-mockup.html:1432-1441). One plate (frame/devices/InstrumentPlate.tsx on the SDK's FacePlate), its columns the holder
// table's sections (studioModel.ts). Ported, not recreated — it replaces the old device chain of components/NativeWorldDetail.tsx
// (the Object select, Configure, Deep edit and ↻ of its header, and the rack strip, chosen controls and macro rack of its device view):
//   • the field devices stand in their sections through the device runtime (DeviceView, the same devices the rack, the pool and a pane
//     show: components/devices/ExpressionsDeviceView.tsx useFieldDevices), one shown at a time behind its mark;
//   • Selected holds the Object chooser (the old header's select), the Force card's modes (components/NativeDeviceStrip.tsx:9) and the
//     compact glyph editor (the old device view's .native-chain-glyph);
//   • the object and Scene devices a section holds are listed with their light, open their settings in the pool (the rack title's
//     press) and go on the rack with + (the rack's + Device);
//   • the head's marks are Configure (the settings: your rack, chosen controls, macros, the Scene), Deep edit and Read again;
//   • a device dragged from the browser onto the plate goes on the rack (the rack's drop, components/NativeDeviceRack.tsx:90);
//   • Tools and Capture hold the stage's own controls, moved out of the Expressions pane (PATH §1: controls in the device, never chrome
//     in a pane): the view in Tools, still | video, ◉ Capture, Present and Edition… in Capture (StudioStage.tsx). They read the frame's
//     chrome as the pane did (projections/expressionsPaneHost.ts useHostedChrome) and send through the frame's one runner.
// Every write leaves through the owner path it used before: the retained editor's one apply, the device's own submit, the stage's runner.
import {useMemo, useState, type DragEvent, type ReactNode} from 'react'
import type {NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import {InstrumentPlate, SectionDevices, SectionNote, type PlateSection, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {selectDevice} from '../../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../../frame/devices/devicePane'
import {openInstrument} from '../../../frame/instrumentDoor'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {PlateMark} from '../../../inhabitants/sdk/controls'
import {inhabitantManifest} from '../../../inhabitants/manifest'
import {QUATERNAL_LOGIC_FAMILY_ID} from '../../../inhabitants/worldShellFamilies'
import {qlFaceEntry} from '../../../inhabitants/ql/devices/TechneDevices'
import {TECHNE_FACE_ICONS} from '../../../inhabitants/ql/devices/faces'
import {useLiveTorusReading, useQlInstrumentFeed} from '../../../live/torusInstrument'
import {EXPRESSIONS_DEVICE_ICONS} from '../../devices/expressionsDevice'
import {modulationWrap, openFieldDeviceFull, useEditorApply, useFieldDevices} from '../../devices/ExpressionsDeviceView'
import {forceStripDevice, selectedEntity} from '../../nativeDeviceStripModel'
import {deviceAddChange} from '../../nativeDeviceRackModel'
import {DEVICE_MIME, afterIdFor, dispatchOpenDevice, parseDeviceDrag} from '../../nativeDrag'
import type {RackDevice} from '../../nativeDeviceCatalogue'
import {GlyphSequenceEditor, type RetainedGlyphInput} from '../../GlyphSequenceEditor'
import {firstShown, onRack, studioFieldFamilies, studioOwner, studioSections, type StudioSection} from './studioModel'
import {StageCaptureTools, StageViewTools, useStageSender} from './StudioStage'
import {useFramePlacement, useHostedChrome} from '../../../projections/expressionsPaneHost'
import './studio.css'

type Request = (request: NativeEditorRequest) => Promise<NativeEditorReply>

export interface ExpressionsStudioProps {
  reading: NativeEditorReading | null
  request: Request
  /** Choose the object the Studio's Selected section acts on (the old header's Object select: the owner's `select`). */
  selectEntity: (id: string) => void
  /** The compact glyph editor's custody, held by the detail so a draft survives the editor's moves. */
  drafts: Map<string, RetainedGlyphInput>
  onExpandGlyph: () => void
  glyphPresented: () => boolean
  /** The settings (Configure): when open, the plate shows them in place of the sections. */
  configure: boolean
  onConfigure: () => void
  settings: readonly PlateSection[]
  /** The person's own controls while they hold any (the chosen controls they picked, their macros): they stand after the sections. */
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
const FORCE_MODES = ['none', 'attract', 'repel', 'vortex'] as const

export function ExpressionsStudio({reading, request, selectEntity, drafts, onExpandGlyph, glyphPresented, configure, onConfigure, settings, own, deep, refresh, fault}: ExpressionsStudioProps) {
  const editor = useEditorApply(reading, request)
  const fields = useFieldDevices(FIELD_FAMILIES, {reading, apply: editor.apply, captureCurrent: editor.captureCurrent, locked: editor.locked})
  const [paneFault, setPaneFault] = useState<string | null>(null)
  const wrapRow = useMemo(() => reading ? modulationWrap(reading) : undefined, [reading])
  const torus = useLiveTorusReading()
  const instrumentReading = useQlInstrumentFeed()
  const [dropping, setDropping] = useState(false)
  const qlFaces = inhabitantManifest(QUATERNAL_LOGIC_FAMILY_ID)?.faces ?? []
  const fieldById = new Map(fields.map(entry => [entry.family, entry]))
  const sceneKey = reading ? `${reading.basis.expression_ref}|${reading.basis.scene_ref}` : 'none'
  // The stage's controls read the frame's chrome by value and send through its one runner (one sender for Tools and Capture).
  const chrome = useHostedChrome()
  const stage = useStageSender(chrome?.state ?? null, chrome?.run ?? null)
  // The frame's faults stand at the foot of the pane that holds it; while no pane holds it, they stand here — never lost.
  const placement = useFramePlacement()

  const fieldDevices = (section: StudioSection): SectionDevice[] => [
    ...section.field.flatMap(entry => {
      const built = fieldById.get(entry.family)
      if (!built?.device || !reading) return []
      const title = built.device.face.title
      return [{device: built.device, mark: EXPRESSIONS_DEVICE_ICONS[entry.family] ?? 'form', key: `${built.id}|${sceneKey}`, wrapRow,
        actions: [
          {icon: 'detail' as const, label: `Show every setting of ${title} in the pool`, onPress: () => selectDevice(built.id)},
          {icon: 'pane' as const, label: `Open ${title} full size in a pane`, onPress: () => setPaneFault(openFieldDeviceFull(entry.family, title))},
        ]}]
    }),
    // The admitted face before the waiting one: the field/PCM owner reads; the torus waits for its owner.
    ...[...section.ql].sort((a, b) => Number(qlFaces.find(face => face.id === a)?.admission === 'waiting') - Number(qlFaces.find(face => face.id === b)?.admission === 'waiting')).flatMap(faceId => {
      const face = qlFaces.find(item => item.id === faceId)
      if (!face) return []
      const entry = qlFaceEntry(face, torus, instrumentReading)
      const title = entry.device.face.title
      return [{device: entry.device, mark: TECHNE_FACE_ICONS[face.id] ?? 'expr', key: entry.device.id,
        actions: [
          {icon: 'detail' as const, label: `Show every setting of ${title} in the pool`, onPress: () => selectDevice(entry.device.id)},
          {icon: 'pane' as const, label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: entry.device.id, title})},
        ]}]
    }),
  ]
  const lit = (family: string) => !!reading && SECTIONS.some(section => section.field.some(device => device.family === family && device.enabled(reading) === true))

  const sectionBody = (section: StudioSection): ReactNode => {
    const devices = fieldDevices(section)
    const listed = [...section.entity.filter(device => device.family !== 'force'), ...section.scene]
    const parts: ReactNode[] = []
    if (section.id === 'studio:tools') parts.push(<StageViewTools key="stage" sender={stage} />)
    if (section.id === 'studio:capture') parts.push(<StageCaptureTools key="stage" sender={stage} />)
    if (section.id === 'studio:selected') parts.push(<SelectedGlyph key="selected" reading={reading} selectEntity={selectEntity} locked={editor.locked}
      send={changes => void editor.apply(changes)} drafts={drafts} request={request} onExpandGlyph={onExpandGlyph} glyphPresented={glyphPresented} />)
    const first = firstShown(section.field.map(device => device.family), reading, lit)
    if (devices.length) parts.push(<SectionDevices key="devices" label={section.title} devices={devices} initial={first ? `expressions:${first}` : null} />)
    else if (section.field.length) parts.push(<SectionNote key="closed">Open a native Expression to see its {section.field.map(device => device.name).join(', ')}.</SectionNote>)
    if (listed.length) parts.push(<StudioDeviceList key="listed" devices={listed} reading={reading} locked={editor.locked}
      add={family => void editor.apply([deviceAddChange(family)])} />)
    if (!parts.length) parts.push(<SectionNote key="none">{section.id === 'studio:nara-m4'
      ? 'No owner discloses the Nara layer in this shell, so nothing here can turn it on.'
      : 'No owner discloses a device here.'}</SectionNote>)
    return parts
  }

  const sections: PlateSection[] = configure ? [...settings] : [...SECTIONS.map(section => ({
    id: section.id, title: section.title, note: section.note ?? undefined, children: sectionBody(section),
  })), ...own]

  // A device dragged from the browser goes on the rack, appended after the last widget — the rack's own drop, one device-add. Over the
  // rack itself (in the settings) the rack takes the drop at its gap and the plate stands aside: one drop, one add.
  const isDeviceDrag = (event: DragEvent<HTMLElement>) => !event.defaultPrevented && !!reading && !editor.locked && event.dataTransfer.types.includes(DEVICE_MIME)
  const actions: {icon: PlateMark; label: string; onPress: () => void}[] = [
    {icon: 'cmd', label: configure ? 'Close the settings' : 'Configure: your rack, chosen controls, macros and the Scene', onPress: onConfigure},
    ...(deep.available ? [{icon: 'full' as const, label: deep.open ? 'Return the Studio to its place' : 'Deep edit: the Studio at full height', onPress: deep.onPress}] : []),
    ...(refresh.available ? [{icon: 'orbit' as const, label: 'Read the retained editor again', onPress: refresh.onPress}] : []),
  ]
  // One line: the editor's refusal, the stage's refusal, and the frame's faults while no pane holds the frame.
  const said = [fault ?? paneFault ?? editor.error, stage.refusal, ...(placement === null ? chrome?.faults ?? [] : [])].filter((text): text is string => !!text)
  const shown = said.length ? said.join(' · ') : null
  return <InstrumentPlate presentation={{family: 'expressions', faceId: 'studio', title: 'Studio', icon: 'expr', owner: studioOwner(reading)}}
    actions={actions} sections={sections} bodyClassName="native-device-view"
    dataAttributes={{'data-studio': configure ? 'settings' : 'sections', 'data-dropping': dropping ? 'true' : undefined, 'data-dirty': reading?.standing.dirty ? 'true' : undefined}}
    onDragOver={event => { if (!isDeviceDrag(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDropping(true) }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false) }}
    onDrop={event => {
      setDropping(false)
      if (!isDeviceDrag(event) || !reading) return
      event.preventDefault()
      const family = parseDeviceDrag(event.dataTransfer.getData(DEVICE_MIME))
      if (family) void editor.apply([{kind: 'device-add', family, after_id: afterIdFor(reading.devices.length, reading.devices.map(device => device.id))}])
    }}
    footer={shown ? <p className="studio-fault" role="alert">{shown}</p> : undefined} />
}

/** Selected · the glyph: which object the Studio acts on, and what it does to it — the Force card's modes, the glyph's clip compact. */
function SelectedGlyph({reading, selectEntity, locked, send, drafts, request, onExpandGlyph, glyphPresented}: {reading: NativeEditorReading | null; selectEntity: (id: string) => void
  locked: boolean; send: (changes: Parameters<ReturnType<typeof useEditorApply>['apply']>[0]) => void; drafts: Map<string, RetainedGlyphInput>; request: Request
  onExpandGlyph: () => void; glyphPresented: () => boolean}) {
  const entity = reading ? selectedEntity(reading) : null
  const force = reading ? forceStripDevice(reading) : null
  const formation = !!reading && reading.scene.entities.some(item => item.kind === 'formation' && reading.selection.entity_ids.includes(item.id))
  return <div className="studio-selected">
    <label className="studio-chooser"><span>Object</span>
      <select aria-label="Native editor selection" value={reading?.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : ''}
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
          <p className="studio-summary" title={force.summary}>{force.summary}</p>
        </div>
      : <p className="inst-section-line">{reading ? 'Choose one object to act on it.' : 'Open a native Expression to act on its objects.'}</p>}
    {formation && <div className="studio-glyph"><GlyphSequenceEditor compact reading={reading} request={request} drafts={drafts} onExpand={onExpandGlyph} isPresented={glyphPresented} /></div>}
  </div>
}

/** The object and Scene devices a section holds: each with the owner's light, its settings in the pool, and + to put it on the rack. */
function StudioDeviceList({devices, reading, locked, add}: {devices: readonly RackDevice[]; reading: NativeEditorReading | null; locked: boolean; add: (family: string) => void}) {
  return <ul className="studio-list" aria-label="Devices">
    {devices.map(device => {
      const on = reading ? device.enabled(reading) : undefined
      const state = on === undefined ? 'unknown' : on ? 'on' : 'off'
      const placed = onRack(reading, device.family)
      return <li key={device.family} className="studio-list-row" data-family={device.family} data-on-rack={placed || undefined}>
        <span role="img" className={`sdk-power sdk-power--${state}`} aria-label={`${device.name} ${state}`} />
        <button type="button" className="studio-row-name" title={reading ? device.summary(reading) : 'Open settings'}
          onClick={() => dispatchOpenDevice({scope: device.scope, family: device.family})}>{device.name}</button>
        {placed
          ? <span className="studio-row-note" title="On your rack: the settings show it among your devices">rack</span>
          : <button type="button" className="studio-row-add" aria-label={`Add ${device.name} to the rack`} title="Add it to your rack" disabled={!reading || locked}
              onClick={() => add(device.family)}><Icon name="plus" size={10} /></button>}
      </li>
    })}
  </ul>
}
