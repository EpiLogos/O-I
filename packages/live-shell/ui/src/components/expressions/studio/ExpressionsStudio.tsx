// The Expressions Studio on the Device side (manual §3: "In Expressions it is the studio that shapes the field"; §7: "The studio sits
// in the device area: the field's tools; what you can do with the symbol you have selected …; then formation, material, motion, the body
// of the field, a personal layer that stays yours however the scene is shared, and capture. Behind the studio stand the devices that
// govern the field itself … each a whole device with every setting it needs"; lock §2.4 Device = Studio; the mockup's Studio at
// world-shell-mockup.html:1432-1441). One plate (frame/devices/InstrumentPlate.tsx on the SDK's FacePlate), its columns the holder
// table's sections (studioModel.ts). Ported, not recreated — it replaces the old device chain of components/NativeWorldDetail.tsx
// (the Object select, Configure, Deep edit and ↻ of its header, and the rack strip, chosen controls and macro rack of its device view):
//   • the field devices stand in their sections through the device runtime (DeviceView, the same devices the rack, the pool and a pane
//     show: components/devices/ExpressionsDeviceView.tsx useFieldDevices), one shown at a time behind its mark;
//   • Selected holds two pages in its head (manual §16.9 "When a panel holds more than fits, it gets pages in its head"): Object — the
//     Object chooser (the old header's select), the Force card's modes (components/NativeDeviceStrip.tsx:9) and the object devices — and
//     Glyph — the selected formation's sequence as kit controls (ported from GlyphSequenceEditor.tsx:296-301, its compose, clock, order,
//     rate and phase, through the same `sequence-settings` change); its states open in the clip (States ⤢). The work has one Save, the
//     head's: the glyph editor's own Save (GlyphSequenceEditor.tsx:293, the editor's `save`) is not drawn here;
//   • the object and Scene devices a section holds are listed with their light, open their settings in the pool (the rack title's
//     press) and go on the rack with + (the rack's + Device);
//   • the head's marks are Configure (the settings: your rack, chosen controls, macros, the Scene), Deep edit and Read again;
//   • a device dragged from the browser onto the plate goes on the rack (the rack's drop, components/NativeDeviceRack.tsx:90);
//   • Tools and Capture hold the stage's own controls, moved out of the Expressions pane (PATH §1: controls in the device, never chrome
//     in a pane): the view in Tools, still | video, ◉ Capture, Present and Edition… in Capture (StudioStage.tsx). They read the frame's
//     chrome as the pane did (projections/expressionsPaneHost.ts useHostedChrome) and send through the frame's one runner.
//   • the head says where the work stands — the Scene, the time, the marker, as the frame announces its address (lane-3 E22) — and
//     its link mark copies that address whole, in the frame's own form (ticket P, G3); Capture says where the last export landed (G1);
//   • the columns fit the detail row by the plate's fold: before Capture, they fold to their titles until Capture is in view
//     (studioFit.ts); a title folds or opens its column, and the person's choice holds. Each column fits the band's height (studioBand.ts):
//     its parts stand side by side, the frame's keys flow down the band's rows and across, a held device scales to the band
//     (studioDevices.tsx) and a section whose device the band cannot hold even at 80 % folds to its title, its strip showing the device
//     whole in the pool. Nothing in the plate scrolls and no box stands in a box.
// Every write leaves through the owner path it used before: the retained editor's one apply, the device's own submit, the stage's runner.
import {useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode} from 'react'
import {addressLink} from '@epilogos/expressions-boundary'
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeEditorRequest, NativeSequenceSettings} from '@epilogos/expressions-boundary/editor'
import {InstrumentPlate, SectionNote, type PlateSection, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {OwnerValueBox, PlateRadio, PlateReading} from '../../../frame/devices/plateControls'
import {Action} from '../../../inhabitants/sdk/panel'
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
import type {RetainedGlyphInput} from '../../GlyphSequenceEditor'
import {firstShown, onRack, studioFieldFamilies, studioOwner, studioPlace, studioSections, type StudioSection} from './studioModel'
import {STUDIO_FOLD_ORDER} from './studioFit'
import {StudioDevice, StudioDeviceMarks, shownDevice} from './studioDevices'
import {chromeRows, useStudioBand} from './studioBand'
import {usePlateFit} from '../../../frame/devices/plateFit'
import {StageCaptureTools, StageViewTools, useStageSender} from './StudioStage'
import {FrameControls, controlsAt, useFrameChromeOver} from './frameChrome'
import {STUDIO_CARRIED} from './studioModel'
import {NativeChosenControls} from '../../NativeChosenControls'
import {useFramePlacement, useHostedChrome} from '../../../projections/expressionsPaneHost'
import './studio.css'

type Request = (request: NativeEditorRequest) => Promise<NativeEditorReply>

export interface ExpressionsStudioProps {
  reading: NativeEditorReading | null
  request: Request
  /** Choose the object the Studio's Selected section acts on (the old header's Object select: the owner's `select`). */
  selectEntity: (id: string) => void
  /** The compact glyph editor's custody (the detail still hands it). The Studio no longer draws that editor: its sequence stands as the
   * Glyph page's kit controls, which hold no typed draft, and its states open in the clip through `onExpandGlyph`. */
  drafts: Map<string, RetainedGlyphInput>
  /** Open the selected formation's glyph clip (Clip view › States, deep). */
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


export function ExpressionsStudio({reading, request, selectEntity, onExpandGlyph, configure, onConfigure, settings, own, deep, refresh, fault}: ExpressionsStudioProps) {
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
  // The frame's own chrome (T-FRAME-CHROME-ONTO-PLATES): what its masthead and scene bar drew in the pane and no other device carries
  // stands here, each press the frame's own control pressed through the same runner (frameChrome.tsx).
  const frame = useFrameChromeOver(chrome?.state ?? null, chrome?.run ?? null)
  const frameAt = (homes: Parameters<typeof controlsAt>[1]) => controlsAt(frame.reading, homes, STUDIO_CARRIED)
  // The frame's faults stand at the foot of the pane that holds it; while no pane holds it, they stand here — never lost.
  const placement = useFramePlacement()
  // lane-3 E22 (ticket P, G3): where the work stands, only as the frame announces it; the link mark copies it whole.
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
  // Which device each section shows (a choice, never a reading), and each shown device's height at 100 % as last drawn.
  const [picked, setPicked] = useState<Readonly<Record<string, string>>>({})
  const [naturals, setNaturals] = useState<Readonly<Record<string, number>>>({})
  const heard = useCallback((section: string) => (_short: boolean, natural: number) =>
    setNaturals(was => (was[section] === natural ? was : {...was, [section]: natural})), [])
  const [selectedPage, setSelectedPage] = useState<'object' | 'glyph'>('object')

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
  /** The device a section shows now (studioDevices.tsx shownDevice): the person's pick, else the one on the rack, the lit one, the first. */
  const shownIn = (section: StudioSection, devices: readonly SectionDevice[]) => {
    const first = firstShown(section.field.map(device => device.family), reading, lit)
    return shownDevice(devices, picked[section.id], first ? `expressions:${first}` : null)
  }

  // The toolbar is curated (owner, 15 Oct: "the rack device view was meant to be the toolbar, which should be letting you curate the
  // settings and macros which you are adding to the toolbar, just like it works in the current expressions app"): the person's chosen
  // controls — the frame's own toolbelt, Journey.shared.toolbelt, through the boundary's chosen controls — always stand on the Studio
  // with their + Parameter, as the toolbelt stood behind its handle (shell.ts #toolbelt-panel "Add properties"); with none chosen yet,
  // the section says so and offers the browse. They page in the section (NativeChosenControls.tsx); the macros of the person's racks
  // stand beside them while held (NativeWorldDetail.tsx).
  const yours: readonly PlateSection[] = [{id: 'chosen', title: 'Your controls', children: <NativeChosenControls reading={reading} request={request} configure={false} />},
    ...own.filter(section => section.id !== 'chosen')]
  // The columns fit the row by the plate's fold (plateFit.ts, moved out of here whole): measured there, decided by studioFit.ts over the
  // Studio's own fold order.
  // The person's own columns (Your controls, their macros) fold first, then the Studio's own from the one nearest Capture: the mockup's
  // eight groups stand longest (:1432-1441); a folded column is one press from open.
  const columnKey = (configure ? settings : [...SECTIONS, ...yours]).map(section => section.id).join('|')
  const fit = usePlateFit(columnKey, [...yours.map(section => section.id).reverse(), ...STUDIO_FOLD_ORDER], configure)
  // The band every column's controls stand in (studioBand.ts): the frame's keys flow down its rows, a held device scales to it.
  const band = useStudioBand(fit.fitId, columnKey)
  const rows = chromeRows(band)

  /** One section's controls, side by side, each part fitted to the band; its head's note (the marks of the devices it holds, its pages). */
  const sectionParts = (section: StudioSection): {body: ReactNode; note?: ReactNode; short?: string} => {
    const devices = fieldDevices(section)
    const shown = devices.length ? shownIn(section, devices) : undefined
    const listed = [...section.entity.filter(device => device.family !== 'force'), ...section.scene]
    const parts: ReactNode[] = []
    let note: ReactNode = section.note ?? undefined
    // Tools: the frame's rail tools and workspace (shell.ts mountShell #tool-rail, #workspace-menu), the scene bar's Acts and Save scene
    // (actPanel.ts :59, shell.ts nav.instrument), then the stage's view. The work's own acts (Save, Undo, Redo — the frame's masthead,
    // app.ts :2814 and its history menu) stand in the head, as the mockup draws Save there (:1432).
    if (section.id === 'studio:tools') parts.push(<FrameControls key="frame-tools" label="Frame tools" controls={frameAt(['tools', 'scene', 'side'])} view={frame} />,
      <StageViewTools key="stage" sender={stage} />)
    // Nara: the frame's own Nara instrument (naraInstrument.tsx :307), opened from here.
    if (section.id === 'studio:nara-m4') parts.push(<FrameControls key="frame-nara" label="Nara" controls={frameAt('nara')} view={frame} />)
    if (section.id === 'studio:capture') parts.push(<StageCaptureTools key="stage" sender={stage} />)
    if (section.id === 'studio:selected') {
      const formation = selectedFormation(reading)
      note = <span className="dp-pager studio-pages" role="tablist" aria-label="Selected: pages">
        {(['object', 'glyph'] as const).map(page => <button key={page} type="button" role="tab" aria-selected={selectedPage === page}
          data-i={page === 'object' ? 'Object|The object the Studio acts on, its force and its devices.' : 'Glyph|The selected formation\'s glyph sequence.'}
          onClick={() => setSelectedPage(page)}>{page === 'object' ? 'Object' : 'Glyph'}</button>)}
      </span>
      if (selectedPage === 'glyph') parts.push(<SelectedSequence key="glyph" reading={reading} formation={formation} locked={editor.locked}
        apply={changes => void editor.apply(changes)} onExpand={onExpandGlyph} />)
      else parts.push(<SelectedObject key="selected" reading={reading} selectEntity={selectEntity} locked={editor.locked} send={changes => void editor.apply(changes)} />)
    }
    if (shown) {
      note = <>{<StudioDeviceMarks devices={devices} shown={shown.device.id} label={section.title} onPick={id => setPicked(was => ({...was, [section.id]: id}))} />}{section.note && <span className="studio-provenance">{section.note}</span>}</>
      parts.push(<StudioDevice key="device" entry={shown} band={band} onShort={heard(section.id)} />)
    } else if (section.field.length) parts.push(<SectionNote key="closed">Open a native Expression to see its {section.field.map(device => device.name).join(', ')}.</SectionNote>)
    if (listed.length && !(section.id === 'studio:selected' && selectedPage === 'glyph')) parts.push(<StudioDeviceList key="listed" devices={listed} reading={reading} locked={editor.locked}
      add={family => void editor.apply([deviceAddChange(family)])} />)
    if (section.id === 'studio:nara-m4' && !devices.length && !listed.length && !frameAt('nara').length) parts.push(<SectionNote key="none">No owner discloses the Nara layer in this shell, so nothing here can turn it on.</SectionNote>)
    if (!parts.filter(Boolean).length) parts.push(<SectionNote key="none">No owner discloses a device here.</SectionNote>)
    // A section whose device the band cannot hold even at 80 % folds to its title (studioDevices.tsx heldScale).
    const natural = naturals[section.id]
    const short = shown && band && natural && band / natural < 0.796 ? shown.device.id : undefined
    return {body: <div className="studio-cols" style={{'--chrome-rows': rows} as CSSProperties}>{parts}</div>, note, ...(short ? {short} : {})}
  }

  // The head: where the work stands against its last save (the mockup's "edited since save", :1432), then the work's own acts — the
  // frame's Save, Undo and Redo, each its own control pressed (frameChrome.tsx). The work's one Save is this one.
  const work = frameAt('work')
  const head = reading || work.length ? <>
    {reading && <span className="studio-head-standing" data-dirty={reading.standing.dirty ? 'true' : undefined}
      data-i={`Standing|${reading.standing.dirty ? 'Edited since the last save.' : 'As saved.'}`}>{reading.standing.dirty ? 'edited since save' : 'saved'}</span>}
    <FrameControls label="Work" controls={work} view={frame} />
  </> : undefined
  const sections: PlateSection[] = configure ? [...settings] : [...SECTIONS.map(section => {
    const parts = sectionParts(section)
    // A short section's strip shows its device whole in the pool (the press on a plate on a chain, manual §16.3).
    return {id: section.id, title: section.title, note: parts.note, children: parts.body,
      folded: !!parts.short || fit.folded.has(section.id), onFold: parts.short ? () => selectDevice(parts.short!) : () => fit.press(section.id)}
  }), ...yours.map(section => section.folded !== undefined || section.onFold ? section : {...section, folded: fit.folded.has(section.id), onFold: () => fit.press(section.id)})]

  // A device dragged from the browser goes on the rack, appended after the last widget — the rack's own drop, one device-add. Over the
  // rack itself (in the settings) the rack takes the drop at its gap and the plate stands aside: one drop, one add.
  const isDeviceDrag = (event: DragEvent<HTMLElement>) => !event.defaultPrevented && !!reading && !editor.locked && event.dataTransfer.types.includes(DEVICE_MIME)
  const actions: {icon: PlateMark; label: string; onPress: () => void}[] = [
    {icon: 'cmd', label: configure ? 'Close the settings' : 'Configure: your rack, chosen controls, macros and the Scene', onPress: onConfigure},
    ...(deep.available ? [{icon: 'full' as const, label: deep.open ? 'Return the Studio to its place' : 'Deep edit: the Studio at full height', onPress: deep.onPress}] : []),
    ...(refresh.available ? [{icon: 'orbit' as const, label: 'Read the retained editor again', onPress: refresh.onPress}] : []),
    ...(chrome?.reopen ? [{icon: 'orbit' as const, label: 'Reopen the native work: the frame\'s host is gone', onPress: chrome.reopen}] : []),
    ...(link ? [{icon: 'link' as const, label: `Copy address: ${link}`, onPress: copyAddress}] : []),
  ]
  // One line: the editor's refusal, the stage's refusal, and the frame's faults while no pane holds the frame.
  const said = [fault ?? paneFault ?? editor.error, stage.refusal, frame.refusal, ...(placement === null ? chrome?.faults ?? [] : [])].filter((text): text is string => !!text)
  const shown = said.length ? said.join(' · ') : null
  return <InstrumentPlate presentation={{family: 'expressions', faceId: 'studio', title: 'Studio', icon: 'expr', owner: studioOwner(reading, place)}}
    head={head} actions={actions} sections={sections} bodyClassName="native-device-view" fit={configure ? undefined : fit}
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
    footer={shown || copyNote ? <>
      {shown && <p className="studio-fault" role="alert">{shown}</p>}
      {copyNote && <p className="studio-note" role="status">{copyNote}</p>}
    </> : undefined} />
}

/** The one formation the Selected section's Glyph page acts on: the selected object, when it is a formation. */
export function selectedFormation(reading: NativeEditorReading | null) {
  return reading ? reading.scene.entities.find(item => item.kind === 'formation' && reading.selection.entity_ids.length === 1 && reading.selection.entity_ids[0] === item.id) ?? null : null
}

/** Selected · Object: which object the Studio acts on, and what it does to it — the Force card's modes and its reading. */
function SelectedObject({reading, selectEntity, locked, send}: {reading: NativeEditorReading | null; selectEntity: (id: string) => void
  locked: boolean; send: (changes: NativeEditorChange[]) => void}) {
  const entity = reading ? selectedEntity(reading) : null
  const force = reading ? forceStripDevice(reading) : null
  return <div className="studio-selected">
    <label className="studio-chooser" data-i="Object|The object the Studio acts on.">
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

/** Selected · Glyph: the selected formation's glyph sequence as kit controls — how it composes, its clock, its order, its rate and phase —
 * each one `sequence-settings` change through the Studio's one apply (ported from GlyphSequenceEditor.tsx:149 `settings` and its top
 * controls :296-301). The states themselves are the clip's material: States ⤢ opens them (Clip view › States). The work's Save is the
 * head's. */
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
