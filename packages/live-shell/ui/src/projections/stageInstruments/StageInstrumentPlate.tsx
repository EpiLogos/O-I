// The plate of a Technē instrument the hosted stage draws — M1′ Canvas, M2′ Timeline or M3′ Journey — open on the rack
// (T-FRAME-CHROME-ONTO-PLATES; lock §2.5; manual §17.3–§17.5; the mockup's M1/M2/M3 plates, world-shell-mockup.html:1457-1459). Beside
// the atlas's M4′ and M5′ plates (projections/atlas/places/PlacesPlate.tsx, palaces/PalacePlate.tsx), registered the same way
// (inhabitants/ql/devices/TechneDevices.tsx OWN_PLATES). The pane draws only the instrument's material; every control the frame drew
// over it — the research tools dock, the canvas's zoom keys and minimap toggle, the selected card's panel, the scene bar, the masthead —
// stands here in the manual's groups (stageInstrumentModel.ts), read from the frame's published chrome and pressed through its one
// runner (components/expressions/studio/frameChrome.tsx). Ported, not recreated: each key is the frame's own control
// (expressions-app field-studies-journeys/src/researchInstruments.tsx, journeyInstrument.tsx, shell.ts, app.ts), pressed.
import type {ReactNode} from 'react'
import {InstrumentPlate, SectionNote, type PlateSection, type SectionDevice} from '../../frame/devices/InstrumentPlate'
import type {FacePresentation} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import {FrameControls, WaitingRow, controlsAt, useFrameChrome, type FrameChromeView} from '../../components/expressions/studio/frameChrome'
import {usePlateFit} from '../../components/expressions/studio/plateFit'
import {EXPRESSION_SECTION, STAGE_PLATES, type StageInstrumentId, type StageSection} from './stageInstrumentModel'
import './stageInstrumentPlate.css'

const TITLES: Readonly<Record<StageInstrumentId, {title: string; provenance: string; icon: IconName; lens: string}>> = {
  'techne:m1': {title: 'Canvas', provenance: 'M1′', icon: 'form', lens: 'canvas'},
  'techne:m2': {title: 'Timeline', provenance: 'M2′', icon: 'arrangement', lens: 'timeline'},
  'techne:m3': {title: 'Journey', provenance: 'M3′', icon: 'journey', lens: 'journey'},
}

function SectionBody({section, view}: {section: StageSection; view: FrameChromeView}) {
  const controls = controlsAt(view.reading, section.homes)
  return <>
    <FrameControls controls={controls} view={view} label={section.title} />
    {!controls.length && section.empty && <SectionNote>{section.empty}</SectionNote>}
    {(!section.waitingWhenEmpty || !controls.length) && section.waiting?.map(parameter => <WaitingRow key={parameter.name} {...parameter} />)}
  </>
}

/** The plate over the frame's chrome. `families` are the columns of the devices the families declare this instrument holds, each device
 * open as it stood before (TechneDevices.tsx OpenInstrument): they stand after the frame's groups and the Expression — none is dropped. */
export function StageInstrumentPlate({id, focused, families = []}: {id: StageInstrumentId; focused: boolean; families?: readonly PlateSection[]}) {
  const view = useFrameChrome()
  const meta = TITLES[id]
  // The columns fit the device row by the plate's fold, as the Studio's do (plateFit.ts; manual §10.4 "A device can also fold down to its
  // title. Click the title to open it again"; owner, 15 Oct: "no scrollers" — a column that cannot fit is a fold, not a scroller): the
  // Expression and a group the frame places nothing in stand folded until pressed; when the row is still too narrow the held families
  // fold from the end, then the lens's later groups. A press holds.
  const groups = STAGE_PLATES[id]
  const fit = usePlateFit([...groups.map(section => section.id), EXPRESSION_SECTION.id, ...families.map(section => section.id)].join('|'),
    [...families.map(section => section.id).reverse(), EXPRESSION_SECTION.id, ...groups.slice(1).map(section => section.id).reverse()], false, [EXPRESSION_SECTION.id])
  const fold = (section: PlateSection, empty = false): PlateSection => {
    const folded = fit.folded.has(section.id) || (empty && !fit.opened.has(section.id))
    return {...section, folded, onFold: () => fit.press(section.id, folded)}
  }
  // The frame draws a lens's tools only while it stands in that lens: on another lens the plate says which it stands in.
  const standing = view.reading?.lens ?? null
  const elsewhere = standing !== null && standing !== meta.lens
  const presentation: FacePresentation = {family: 'techne', faceId: id, title: meta.title, icon: meta.icon,
    owner: [meta.provenance, 'Technē', 'the Expressions stage', focused ? 'open on the focused pane' : 'opened here',
      view.presentation === 'frame' ? 'its controls in the pane at full size' : null].filter(Boolean).join(' · ')}
  const sections: PlateSection[] = [
    ...groups.map(section => fold({id: section.id, title: section.title, width: section.width,
      children: elsewhere ? <SectionNote>{`The stage stands in its ${standing} lens: open ${meta.title} on the focused pane to draw its ${section.title.toLowerCase()} here.`}</SectionNote>
        : view.reason && !view.reading ? <SectionNote>{view.reason}</SectionNote> : <SectionBody section={section} view={view} />},
      !elsewhere && !!view.reading && !controlsAt(view.reading, section.homes).length && !section.waiting?.length)),
    fold({id: EXPRESSION_SECTION.id, title: EXPRESSION_SECTION.title, width: EXPRESSION_SECTION.width,
      children: view.reading ? <FrameControls controls={controlsAt(view.reading, EXPRESSION_SECTION.homes)} view={view} label={EXPRESSION_SECTION.title} />
        : <SectionNote>{view.reason ?? 'The stage has not reported its controls yet.'}</SectionNote>}),
    ...families.map(section => fold(section)),
  ]
  return <InstrumentPlate presentation={presentation} sections={sections}
    dataAttributes={{'data-instrument': id, 'data-expanded': 'true', 'data-stage-plate': meta.lens, 'data-presentation': view.presentation ?? undefined, 'data-studio-fit': fit.fitId}}
    footer={view.refusal ? <p className="stage-plate-fault" role="alert">{view.refusal}</p> : undefined} />
}

/** The stage instruments' own plates, registered by holder beside M4′ and M5′ (inhabitants/ql/devices/TechneDevices.tsx OWN_PLATES). */
export const STAGE_OWN_PLATES: Readonly<Record<StageInstrumentId, (props: {held: readonly (SectionDevice & {face: string})[]; focused: boolean; families: readonly PlateSection[]}) => ReactNode>> = {
  'techne:m1': ({focused, families}) => <StageInstrumentPlate id="techne:m1" focused={focused} families={families} />,
  'techne:m2': ({focused, families}) => <StageInstrumentPlate id="techne:m2" focused={focused} families={families} />,
  'techne:m3': ({focused, families}) => <StageInstrumentPlate id="techne:m3" focused={focused} families={families} />,
}
