// The plate of a Technē instrument the hosted stage draws — M1′ Canvas, M2′ Timeline or M3′ Journey — open on the rack
// (T-FRAME-CHROME-ONTO-PLATES; lock §2.5; manual §17.4–§17.6; the mockup's M1/M2/M3 plates, world-shell-mockup.html:1457-1459). Beside
// the atlas's M4′ and M5′ plates (projections/atlas/places/PlacesPlate.tsx, palaces/PalacePlate.tsx), registered the same way
// (inhabitants/ql/devices/TechneDevices.tsx OWN_PLATES). The pane draws only the instrument's material; every control the frame drew
// over it — the research tools dock, the canvas's zoom keys and minimap toggle, the selected card's panel, the scene bar, the masthead —
// stands here in the manual's groups (stageInstrumentModel.ts), read from the frame's published chrome and pressed through its one
// runner (components/expressions/studio/frameChrome.tsx). Ported, not recreated: each key is the frame's own control
// (expressions-app field-studies-journeys/src/researchInstruments.tsx, journeyInstrument.tsx, shell.ts, app.ts), pressed. Drawn in the
// device craft (frameChrome.tsx on the panel kit, ProjectCentral/docs/1-vision/dlw/DLW.md §16): keys lit by the frame's reading, bounded numbers swept, a
// parameter the manual names that no owner carries drawn as its switch with nothing lit and its reason on the status line.
// The plate's head is the panel kit's (InstrumentPlate.tsx), its display section the instrument's live well (inhabitants/ql/devices/
// techneWells.tsx: the board, the ruler, the walk), and no sentence stands in it (ProjectCentral/docs/1-vision/dlw/DLW.md §16.9): a frame reading that is a
// save state is a light, one that is a line of words is a light whose words are the status bar's, a group the frame places nothing in
// says one word with its reason on the status bar, and a parameter no owner carries draws disabled with its reason (§6 Disabled).
//
// Lane W4-Technē: an instrument's catalogue design (techne:canvas, techne:journey) heads its chain on the frame's own research reading and
// acts (techne/devices/frameBindings.ts), so this plate keeps only what the design does not carry yet (stageInstrumentModel.ts
// CARRIED_BY_DESIGN): no well (the design's display is the picture), no waiting rows (the design draws those parameters with their reasons),
// no group or control the design reads and writes itself. M2′'s design, the Timeline, was retired in the 22 Oct manual rewrite (§17.5: the
// timeline is Arrangement view), so its plate draws its own well first and every group (HEADED_BY_DESIGN).
import type {ReactNode} from 'react'
import type {FrameChromeControl} from '@epilogos/expressions-boundary'
import {InstrumentPlate, SectionNote, type PlateSection} from '../../frame/devices/InstrumentPlate'
import {Lamp} from '../../inhabitants/sdk/panel'
import type {FacePresentation} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import {FrameControl, controlsAt, useFrameChrome, type FrameChromeView} from '../../components/expressions/studio/frameChrome'
import {usePlateFit} from '../../frame/devices/plateFit'
import type {OwnPlateProps} from '../../inhabitants/ql/devices/TechneDevices'
import {CARRIED_BY_DESIGN, EXPRESSION_SECTION, HEADED_BY_DESIGN, STAGE_PLATES, carriedByDesign, type StageInstrumentId, type StageSection} from './stageInstrumentModel'
import {wellSection} from '../../inhabitants/ql/devices/techneWells'
import './stageInstrumentPlate.css'

const TITLES: Readonly<Record<StageInstrumentId, {title: string; provenance: string; icon: IconName; lens: string}>> = {
  'techne:m1': {title: 'Canvas', provenance: 'M1′', icon: 'form', lens: 'canvas'},
  'techne:m2': {title: 'Timeline', provenance: 'M2′', icon: 'arrangement', lens: 'timeline'},
  'techne:m3': {title: 'Journey', provenance: 'M3′', icon: 'journey', lens: 'journey'},
}

/** The frame's save glyph (field-studies-journeys researchInstruments.tsx:424 `.research-save-glyph`, read through presentedChrome.ts:225 as
 * its aria-label): saved, saving, or held when the owner refuses. */
const SAVE_STATE = /^(saved|saving|held)\b/i

/** A reading of words longer than a value: a name or a status line, never drawn as a sentence here. */
const isLine = (text: string) => text.length > 16 || text.split(/\s+/).length > 2

/** One of the frame's readings, as the kit draws a reading (manual §16.10 Light: "A state that the owner reports"): the save state as a
 * light (green saved, hollow saving, orange held); a line of words — the canvas's status line — as a light whose words are the status
 * bar's; a short value as the frame gives it. */
export function FrameReading({control, view}: {control: FrameChromeControl; view: FrameChromeView}) {
  const text = (control.value || control.label).trim()
  const save = SAVE_STATE.exec(text)
  if (save) {
    const state = save[1]!.toLowerCase()
    return <span className="dp-cell plate-light" data-chrome={control.id} data-save-state={state} data-i={`Save|${text}: the work's own save state, as the frame reports it.`}>
      <Lamp state={state === 'saving' ? 'unknown' : 'lit'} tone={state === 'held' ? 'stall' : 'green'} label={text} /><span className="dp-label">{state}</span>
    </span>
  }
  if (!isLine(text)) return <FrameControl control={control} view={view} />
  const words = control.value && control.value !== control.label ? `${control.label} — ${control.value}` : control.label
  return <span className="dp-cell plate-light" data-chrome={control.id} data-i={`Status|${words}`} aria-label={words}>
    <Lamp state="lit" tone="value" /><span className="dp-label">status</span>
  </span>
}

/** A run of the frame's controls in its order, its readings drawn as readings (FrameReading), the rest as the frame's own controls. */
export function PlateFrameControls({controls, view, label}: {controls: readonly FrameChromeControl[]; view: FrameChromeView; label: string}): ReactNode {
  if (!controls.length) return null
  return <div className="frame-chrome" role="group" aria-label={label}>
    {controls.map(control => control.kind === 'reading' ? <FrameReading key={control.id} control={control} view={view} /> : <FrameControl key={control.id} control={control} view={view} />)}
  </div>
}

/** The frame's controls of a section the instrument's design does not carry (CARRIED_BY_DESIGN): the design draws the rest itself. */
const uncarried = (id: StageInstrumentId, controls: readonly FrameChromeControl[]) => controls.filter(control => !carriedByDesign(id, control.label))

/** A section's body: the frame's controls the design does not carry. The parameters no owner carried (the plate's waiting rows) are the
 * design's own now, drawn on it with their reasons. */
function SectionBody({id, section, view}: {id: StageInstrumentId; section: StageSection; view: FrameChromeView}) {
  const controls = uncarried(id, controlsAt(view.reading, section.homes))
  return <>
    <PlateFrameControls controls={controls} view={view} label={section.title} />
    {!controls.length && section.empty && <SectionNote word="none">{section.empty}</SectionNote>}
  </>
}

/** The plate over the frame's chrome. `families` are the columns of the devices the families declare this instrument holds, each device
 * open as it stood before (TechneDevices.tsx OpenInstrument): they stand after the frame's groups and the Expression — none is dropped. */
export function StageInstrumentPlate({id, focused, families = [], onFold, onFull}: {id: StageInstrumentId; focused: boolean; families?: readonly PlateSection[]; onFold?: () => void; onFull?: () => void}) {
  const view = useFrameChrome()
  const meta = TITLES[id]
  // The columns fit the device row by the plate's fold, as the Studio's do (plateFit.ts; manual §10.4 "A device can also fold down to its
  // title. Click the title to open it again"; owner, 15 Oct: "no scrollers" — a column that cannot fit is a fold, not a scroller): the
  // Expression and a group the frame places nothing in stand folded until pressed; when the row is still too narrow the held families
  // fold from the end, then the lens's later groups. A press holds. The well never folds.
  // The groups the design carries whole stand on the design, not here (CARRIED_BY_DESIGN).
  const groups = STAGE_PLATES[id].filter(section => !CARRIED_BY_DESIGN[id].sections.includes(section.id))
  const fit = usePlateFit([...groups.map(section => section.id), EXPRESSION_SECTION.id, ...families.map(section => section.id)].join('|'),
    [...families.map(section => section.id).reverse(), EXPRESSION_SECTION.id, ...groups.slice(1).map(section => section.id).reverse()], false, [EXPRESSION_SECTION.id])
  const fold = (section: PlateSection, empty = false): PlateSection => {
    const folded = fit.folded.has(section.id) || (empty && !fit.opened.has(section.id))
    return {...section, folded, onFold: () => fit.press(section.id, folded)}
  }
  // The frame draws a lens's tools only while it stands in that lens: on another lens the plate says which it stands in, in a word.
  const standing = view.reading?.lens ?? null
  const elsewhere = standing !== null && standing !== meta.lens
  const presentation: FacePresentation = {family: 'techne', faceId: id, title: meta.title, icon: meta.icon,
    owner: [meta.provenance, 'Technē', 'the Expressions stage', focused ? 'open on the focused pane' : 'opened here',
      view.presentation === 'frame' ? 'its controls in the pane at full size' : null].filter(Boolean).join(' · ')}
  // The picture is the design's display, at the head of the chain: the plate draws no second well. With no design at its head, the
  // plate's own well is its picture, first and never folded.
  const well = HEADED_BY_DESIGN[id] ? null : wellSection(id)
  const sections: PlateSection[] = [
    ...(well ? [well] : []),
    ...groups.map(section => fold({id: section.id, title: section.title, width: section.width,
      children: elsewhere ? <SectionNote word={`${standing} lens`}>{`The stage stands in its ${standing} lens: open ${meta.title} on the focused pane to draw its ${section.title.toLowerCase()} here.`}</SectionNote>
        : view.reason && !view.reading ? <SectionNote word="waiting">{view.reason}</SectionNote> : <SectionBody id={id} section={section} view={view} />},
      !elsewhere && !!view.reading && !uncarried(id, controlsAt(view.reading, section.homes)).length)),
    fold({id: EXPRESSION_SECTION.id, title: EXPRESSION_SECTION.title, width: EXPRESSION_SECTION.width,
      children: view.reading ? <PlateFrameControls controls={controlsAt(view.reading, EXPRESSION_SECTION.homes)} view={view} label={EXPRESSION_SECTION.title} />
        : <SectionNote word="waiting">{view.reason ?? 'The stage has not reported its controls yet.'}</SectionNote>}),
    ...families.map(section => fold(section)),
  ]
  return <InstrumentPlate presentation={presentation} sections={sections} fit={fit} onFold={onFold} onFull={onFull} fullLabel={`Open ${meta.title} on the focused pane`}
    dataAttributes={{'data-instrument': id, 'data-expanded': 'true', 'data-stage-plate': meta.lens, 'data-presentation': view.presentation ?? undefined}}
    footer={view.refusal ? <p className="stage-plate-fault" role="alert">{view.refusal}</p> : undefined} />
}

/** The stage instruments' own plates, registered by holder beside M4′ and M5′ (inhabitants/ql/devices/TechneDevices.tsx OWN_PLATES). */
export const STAGE_OWN_PLATES: Readonly<Record<StageInstrumentId, (props: OwnPlateProps) => ReactNode>> = {
  'techne:m1': ({focused, families, onFold, onFull}) => <StageInstrumentPlate id="techne:m1" focused={focused} families={families} onFold={onFold} onFull={onFull} />,
  'techne:m2': ({focused, families, onFold, onFull}) => <StageInstrumentPlate id="techne:m2" focused={focused} families={families} onFold={onFold} onFull={onFull} />,
  'techne:m3': ({focused, families, onFold, onFull}) => <StageInstrumentPlate id="techne:m3" focused={focused} families={families} onFold={onFold} onFull={onFull} />,
}
