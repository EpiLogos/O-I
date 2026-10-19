// The M4′ World / Places instrument, open on the rack (T-PLACES-ONTO-ATLAS; FOUNDATION §4 "Places is the Archetypal-Earth atlas,
// alone"; lock §2.5 M4′ "planet builder: body, landmass, climate, sky, locations, relations; scales system · body · region ·
// palace"; the mockup's M4 plate, world-shell-mockup.html:1447-1461 `deviceDetail` k==='M4' and its controls :1385-1397 — knobs for
// Sea level, Continents, Relief, Warmth, Moisture, Ice caps, Atmosphere, Clouds, Axial tilt; segmented Body, Coast, Kind, Relations;
// Locations and Relations as tight lists; manual §17.2 World, Whole: "View, Body, Landmass, Climate, Sky, Locations, Earth layers").
// One plate drawn in the device craft (docs/dlw/DLW.md §16; the panel kit, inhabitants/sdk/panel.tsx): a dial for a value you sweep,
// a radio for one of a few, rows for places, the sections side by side and folded to fit; the atlas pane carries no chrome (owner,
// 14 Oct: "controls live in device UI, never as chrome inside a pane").
//
// The body is the one the World shows (T-WORLDS §5 W3; manual §17.2 "Build a planet"): your world's, from its owner's record
// (`aikit.world-body/v1` on your register's root space, body/worldBody.ts), each knob its setting, written through the World's own body
// setters as one BodySet on the revision read; or Earth, the one world nobody built ("Earth is given. You cannot change its land"), whose
// knobs stand with no reading and say why — never a value nobody holds. What the plate shows is only what the owners return: the suite's places (provider/suiteStanding.ts), the QL owner's Sun (the attach's Sun
// reading), the atlas's own state. What it writes goes through the owners: the Earth ⇄ Graph switch is the atlas's own
// (presentAtlasView, the lens bar's), Whole field the globe's own (atlasFaceActions setWholeField, the face body's), a press on a place
// turns the Earth (the atlas's own navigation), a Relations row narrows the globe through the atlas's one filter (shell/filter.ts), the
// find chooses through the field's own search (data/search.ts), and Place offers a draft to the subject's time-and-place editor
// (placeTool.ts) — the plate never writes a coordinate. The devices M4′ holds (the globe, the Earth ⇄ Graph switch, the QL sky) stand as
// marks on the sections that draw their controls: a press shows one whole in the pool, ⤢ opens it in a pane.
//
// The plate's head is the panel kit's (InstrumentPlate.tsx; manual §16.9) and its display section is the Earth's live well
// (inhabitants/ql/devices/techneWells.tsx: the body as the pane looks at it, its lit side, its located places at their presence; the scale
// at the well's top right). No sentence stands in the plate (manual §16.9): what the owners returned stands as readouts and a light, the
// Place tool's state as a light and one word, a chosen place's source on the status bar — every sentence is the status bar's.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {InstrumentPlate, heldMarksOf, type PlateSection} from '../../../frame/devices/InstrumentPlate'
import {usePlateFit} from '../../../frame/devices/plateFit'
import {HeldMarks, OwnerDial, PlateField, PlateLine, PlateRadio, PlateReading, PlateRows, WaitingDial, said, type PlateRow} from '../../../frame/devices/plateControls'
import {Action, Chooser, Lamp, Readout, Toggle, type Option} from '../../../inhabitants/sdk/panel'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {IconName} from '../../../inhabitants/sdk/icons'
import type {FacePresentation} from '../../../inhabitants/sdk/define'
import {setWholeField} from '../../../inhabitants/atlasFaceActions'
import {presentAtlasView, useAtlasHandle, useAtlasSun, useAtlasView, useSuiteStanding} from '../AtlasProjectionPanel'
import {describeStanding} from '../provider/suiteStanding'
import type {AtlasHandle} from '../mount'
import {search, type SearchResult} from '../src/data/search'
import type {FieldFilter} from '../src/shell/filter'
import {BUILT, LENSES, lensOf, type LensId} from '../src/shell/lens'
import type {LocusType} from '../src/types/field'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import {windowEdgeYear, writeSharedWindow} from '../sharedClock'
import {atlasScale, subscribeAtlasScale, turnAtlasTo} from './placesHost'
import {findPlaceRows, placeRows, precisionCounts, relationRows, routeRows, withinRows, type PlaceRow, type RelationRow} from './placesModel'
import {
  PLACE_KINDS, PLACE_KIND_WAITS, armLanding, armPlaceTool, choosePlaceKind, disarmPlaceTool, draftLine, notePlaceTool, openOfferedEditor, placeKindChoice,
  placeToolState, subscribePlaceTool, unlandArmed, type PlaceKind, type PlaceToolSubject,
} from './placeTool'
import {
  BODY_CHOICES, GIVEN, NO_BODY, NO_OTHER, WORLD_BODY_SETTINGS, bodyChoice, bodyWriteRefusal, bodyWriter, chooseBody, subscribeWorldBody, worldBodyState,
  type BodyChoice,
} from '../body/worldBody'
import {COASTS} from '../src/globe/body'
import {subscribeSystem, systemReading} from '../system/systemStore'
import {writeThroughOwner} from '../../../inhabitants/ql/devices/ownerWrite'
import {palaceLocationRows} from '../palaces/palacesModel'
import {palacesWaiting, readPalaces, usePalaces} from '../palaces/palacesWorld'
import {enterPalace} from '../palaces/palaceSession'
import {wellSection} from '../../../inhabitants/ql/devices/techneWells'
import type {OwnPlateProps} from '../../../inhabitants/ql/devices/TechneDevices'
import './placesPlate.css'

/** The QL family's Sun is drawn on the Earth but is no subject a place can be declared for. */
const SKY_FAMILY = 'ql-sky-subsolar'

/** The mockup's location kinds (`pl.kind`): a place has an owner that declares it, and a palace stands where its rooms' subjects are
 * placed (T-PALACES-ONTO-ATLAS: the world's palaces are listed here, entered from here or the M5 plate); the others say why they wait. */
const KIND_MARKS: Readonly<Record<PlaceKind, IconName>> = {place: 'placed', palace: 'palace', portal: 'direct', route: 'journey'}
const KINDS: readonly {id: PlaceKind; mark: IconName; why: string | null}[] = PLACE_KINDS.map(id => ({id, mark: KIND_MARKS[id], why: PLACE_KIND_WAITS[id]}))

/** The words for a locus, as the atlas's own kind filter names it (shell/filter.ts KIND_LABELS' sense, in plain words). */
const LOCUS_WORDS: Partial<Record<LocusType, string>> = {
  'historical-event': 'events', 'myth-episode': 'myth', artifact: 'placed things', sky: 'sky',
}

/** Why the planet builder waits on Earth (manual §17.2 "Earth is given … Earth and other worlds are read-only"; the mockup's own Earth
 * branch, world-shell-mockup.html:1449). */
const EARTH_GIVEN = 'Earth is given — its land is not built. Place and name locations on it; anchor your body’s locations to it.'
const EARTH_CLIMATE = 'You cannot reshape Earth: its climate is given. Choose Your world to set your own body’s.'
const EARTH_SKY = 'You cannot reshape Earth’s air or tilt: they are given. Choose Your world to set your own body’s.'
const NOT_MOUNTED = 'The Earth has not mounted in this session. Its controls stand once the Earth pane is shown.'

/** The mounted atlas, re-read on its own notices (its clock, its controller's face notices — a state, a filter, a walk). */
function useAtlasLive(): AtlasHandle | null {
  const handle = useAtlasHandle()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    const bump = () => setTick(n => n + 1)
    const offClock = handle.time.subscribe(bump)
    const offFaces = handle.ctl.subscribeFaces(bump)
    return () => { offClock(); offFaces() }
  }, [handle])
  return handle
}

/** The subject the Earth has selected, as the Place tool declares a place for it: an owner's subject, never the Sun. */
export function selectedSubject(handle: AtlasHandle | null): {ref: string; title: string} | null {
  if (!handle) return null
  const view = handle.ctl.state.view
  if (view.kind !== 'manifest') return null
  const index = handle.model.occIndex.get(view.occId)
  const occ = index === undefined ? undefined : handle.model.occ[index]
  if (!occ || !occ.subject_ref || occ.familyId === SKY_FAMILY) return null
  return {ref: occ.subject_ref, title: occ.title}
}

/** The precision grammar's mark (solid · halo · outline · no-coordinate), as the Earth draws each class (globe/presences.ts). */
function PrecisionMark({marker, title}: {marker: string; title: string}) {
  return <span className="places-prec" data-marker={marker} aria-label={title} role="img" />
}

function StandingTag({standing}: {standing: PlaceRow['standing']}) {
  return standing === 'mythic' ? <span className="places-tag" data-standing="mythic" aria-label="Mythic: a place of the story, never a historical locus">mythic</span> : null
}

/** The window the session stands in, as its edges read (the transport's punch-in and punch-out read the same). */
function useWindowLine(): string {
  const window = useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get()?.time_window ?? null, () => null)
  if (!window) return 'all time'
  const from = windowEdgeYear(window.from), to = windowEdgeYear(window.to)
  return `${from ?? '…'} – ${to ?? '…'}`
}

/** The atlas's own lens chooser (src/shell/shell.ts's "Field ▾", stood down in the pane): the lenses it offers (src/shell/lens.ts
 * LENSES, BUILT), the one standing lit, a choice opened through the controller's own openLens. */
function LensChooser({handle}: {handle: AtlasHandle | null}) {
  const current: LensId | null = handle ? lensOf(handle.ctl.state) : null
  const offered = LENSES.filter(lens => BUILT.has(lens.id))
  const options: Option<string>[] = [...(handle ? [] : [{value: '', label: '—'}]), ...offered.map(lens => ({value: lens.id, label: lens.label}))]
  return <Chooser label="Lens" does={offered.find(lens => lens.id === current)?.blurb ?? 'The atlas\'s readings of its field: they stand once the Earth is open.'}
    value={current ?? ''} options={options} onChange={handle ? value => handle.ctl.openLens(value as LensId) : undefined} disabled={handle ? undefined : NOT_MOUNTED} />
}

/** What the atlas's header holds (src/shell/shell.ts headerReading — its line, its scope, the lens's own Options "≡"), stood here while
 * the header stands down in the pane (atlasHost.css; seen in the pane by the lead, 15 Oct: the Theory lens's "Jung's theory ·
 * Dynamics" under a "≡"). Each press is the header's own button pressed, so the lens acts as it always has; the plate keeps no copy. */
export function LensReadings({handle}: {handle: Pick<AtlasHandle, 'ctl'> | null}) {
  const [, setTick] = useState(0)
  const header = handle?.ctl.shell.headerReading()
  if (!header) return null
  const press = (act: () => void) => { act(); setTick(n => n + 1) }
  const line = [header.context, header.heading].filter(Boolean).join(' · ')
  return <div className="plate-span places-lens" role="group" aria-label="The lens's own readings">
    {line && <PlateLine text={line} />}
    {header.scope && <PlateLine text={header.scope.text}>{header.scope.toggle && <button type="button"
      onClick={() => press(header.scope!.toggle!.press)}>{header.scope.toggle.label}</button>}</PlateLine>}
    {header.options.length > 0 && <div className="plate-keys">
      {header.options.map(option => option.pressed === null || option.pressed === undefined
        ? <Action key={option.title} label={option.title} does={option.description || undefined} onPress={() => press(option.press)} disabled={option.disabled ? 'Off in this lens.' : undefined} />
        : <Toggle key={option.title} label={option.title} does={option.description || undefined} on={option.pressed} onChange={() => press(option.press)} disabled={option.disabled ? 'Off in this lens.' : undefined} />)}
    </div>}
  </div>
}

// ── View: how close, as what, through which lens (manual §17.2 Whole "View") ──

function ViewSection({handle}: {handle: AtlasHandle | null}) {
  const view = useAtlasView()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const whole = handle?.ctl.globeScope
  const wholeWhy = !handle ? NOT_MOUNTED : !whole?.scope ? 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.' : undefined
  return <>
    <PlateReading label="Scale" value={scale ?? '—'} does="How close you look, as the atlas stands: field, system, body, region or place. The camera sets it." />
    <PlateRadio inline label="View" does="Space or Graph: the same material, as bodies or by connection — the atlas's own switch, the lens bar's."
      value={view} options={[{value: 'earth', label: 'Space'}, {value: 'graph', label: 'Graph'}]} onChange={next => presentAtlasView(next)} />
    <PlateRadio inline label="Aperture" value={null} options={['World', 'Local', 'Shared', 'Federated'].map(label => ({value: label.toLowerCase(), label}))}
      disabled="How far you look: no owner opens the shared or federated field to the atlas yet." />
    <PlateRadio inline label="View as" value={null} options={['Me', 'Field', 'Public'].map(label => ({value: label.toLowerCase(), label}))}
      disabled="Who you look as: no owner discloses how the field or the public sees your world yet." />
    <PlateRadio inline label="Whole" does={whole?.scope ? `The globe draws ${whole.scope.label} alone, or the whole field.` : 'The whole field, or the mode’s set alone.'}
      value={whole?.scope ? (whole.wholeField ? 'field' : 'set') : null} options={[{value: 'set', label: whole?.scope?.label ?? 'Set'}, {value: 'field', label: 'Field'}]}
      onChange={handle && whole?.scope ? next => setWholeField(handle.engine, next === 'field') : undefined} disabled={wholeWhy} />
    <LensChooser handle={handle} />
    <LensReadings handle={handle} />
  </>
}

// ── Body: whose body (the body store, body/worldBody.ts: your world's record, the view's own choice) ──

/** Your world's body as the plate reads it: the store's reading and the view's choice, and why its knobs cannot write now. */
function useBodyReading() {
  const state = useSyncExternalStore(subscribeWorldBody, worldBodyState, worldBodyState)
  const choice = useSyncExternalStore(subscribeWorldBody, bodyChoice, bodyChoice)
  const record = choice === 'own' && state.state === 'read' ? state.record : null
  // Earth's land and air are given; another world's are its owner's; your own body's knobs write while its owner can take them
  const why = choice === 'earth' ? null : choice === 'other' ? NO_OTHER : bodyWriteRefusal()
  return {state, choice, record, why}
}

/** A setting written through the World's own body setter (agent/shellSetterBridge.ts): one BodySet on the revision read. A refusal is
 * said on the plate's line, in the owner's words. */
const writeBody = (key: string, value: unknown) => {
  void writeThroughOwner(bodyWriter(key), value).catch(error => notePlaceTool(error instanceof Error ? error.message : String(error)))
}

const BODY_WORDS: Readonly<Record<BodyChoice, string>> = {own: 'Your world', earth: 'Earth', other: 'Another world'}

function BodySection() {
  const {state, choice, record, why} = useBodyReading()
  const name = state.state === 'read' && typeof state.reading.space.title === 'string' && state.reading.space.title ? state.reading.space.title : 'Your world'
  const seedWords = choice === 'earth' ? 'Earth is given, so it has no seed to reroll.' : record ? 'The seed your body grows from: the same seed and settings give the same body.'
    : state.state === 'read' ? NO_BODY : why ?? 'Your world’s body is read from its owner.'
  return <>
    <PlateRadio label="Body" does="Whose body the World shows and builds: your world, Earth (the one world nobody built: your root anchor), or another world." value={choice}
      options={BODY_CHOICES.map(value => ({value, label: BODY_WORDS[value], ...(value === 'other' ? {why: NO_OTHER} : {})}))} onChange={next => chooseBody(next as BodyChoice)} />
    <PlateReading label="Name" value={choice === 'earth' ? 'Earth' : choice === 'other' ? '—' : name} does={choice === 'earth' ? 'The body\'s name. Earth is given its own.' : 'Your world\'s name: its register\'s.'} />
    <PlateReading label="Seed" value={record ? String(record.seed) : '—'} does={seedWords} />
    <Action label="Reroll" does="A new body from the same settings. Every location keeps its name and its position." onPress={() => writeBody('reroll', true)}
      disabled={choice === 'earth' ? GIVEN : why ?? (state.state !== 'read' ? 'Your world’s body is read from its owner.' : undefined)} />
  </>
}

// ── the planet builder: Landmass, Climate, Sky (your body's settings; each waiting on Earth, with why) ──

/** One setting of your body as a dial over its owner, or waiting with why (Earth's are given). */
function BodyDial({settingKey, why, earth}: {settingKey: string; why: string | null; earth: string}) {
  const {choice, record} = useBodyReading()
  const setting = WORLD_BODY_SETTINGS.find(entry => entry.key === settingKey)!
  // the plate keeps the mockup's own knob names (world-shell-mockup.html:1385-1397: "Axial tilt")
  const label = settingKey === 'tilt' ? 'Axial tilt' : setting.title
  const unit = setting.range.unit ?? (setting.range.max === 1 ? '%' : '')
  if (choice === 'earth') return <WaitingDial label={label} why={earth} unit={unit} />
  const value = record ? settingValue(record, settingKey) : null
  const format = (v: number) => (unit === '%' ? `${Math.round(v * 100)} %` : unit === '°' ? `${Math.round(v)}°` : `${v.toFixed(1)}×`)
  return <OwnerDial label={label} value={value} def={setting.range.min} scale={{min: setting.range.min, max: setting.range.max}} format={format}
    why={why ?? (record ? undefined : NO_BODY)} onCommit={why || !record ? undefined : v => writeBody(settingKey, Math.round(v * 100) / 100)} />
}

/** A setting's value on the owner's record, by the World device's key (body/worldBody.ts WORLD_BODY_SETTINGS). */
function settingValue(record: NonNullable<ReturnType<typeof useBodyReading>['record']>, key: string): number | null {
  switch (key) {
    case 'seaLevel': return record.landmass.sea_level
    case 'continents': return record.landmass.continents
    case 'relief': return record.landmass.relief
    case 'warmth': return record.climate.warmth
    case 'moisture': return record.climate.moisture
    case 'iceCaps': return record.climate.ice_caps
    case 'atmosphere': return record.sky.atmosphere
    case 'clouds': return record.sky.clouds
    case 'tilt': return record.sky.axial_tilt_deg
    default: return null
  }
}

function LandmassSection() {
  const {choice, record, why} = useBodyReading()
  return <>
    <BodyDial settingKey="seaLevel" why={why} earth={EARTH_GIVEN} />
    <BodyDial settingKey="continents" why={why} earth={EARTH_GIVEN} />
    <BodyDial settingKey="relief" why={why} earth={EARTH_GIVEN} />
    <PlateRadio label="Coast" value={record ? record.landmass.coast : null} options={COASTS.map(value => ({value, label: value}))}
      onChange={record && !why ? next => writeBody('coast', next) : undefined} disabled={choice === 'earth' ? EARTH_GIVEN : why ?? (record ? undefined : NO_BODY)} />
  </>
}

function ClimateSection() {
  const {why} = useBodyReading()
  return <>
    <BodyDial settingKey="warmth" why={why} earth={EARTH_CLIMATE} />
    <BodyDial settingKey="moisture" why={why} earth={EARTH_CLIMATE} />
    <BodyDial settingKey="iceCaps" why={why} earth={EARTH_CLIMATE} />
  </>
}

function SkySection({handle}: {handle: AtlasHandle | null}) {
  const sun = useAtlasSun()
  const {why} = useBodyReading()
  const sunWords = !handle || !sun ? 'The Sun is read once the Earth stands.'
    : sun.line ?? (sun.placed ? 'Drawn overhead where the QL owner states it, for the instant the Earth shows.' : 'Not placed.')
  return <>
    <BodyDial settingKey="atmosphere" why={why} earth={EARTH_SKY} />
    <BodyDial settingKey="clouds" why={why} earth={EARTH_SKY} />
    <BodyDial settingKey="tilt" why={why} earth={EARTH_SKY} />
    <PlateReading label="Sun" light={!handle || !sun ? 'unknown' : sun.placed ? 'lit' : 'dark'} value={!handle || !sun ? '—' : sun.placed ? 'placed' : 'not placed'} does={sunWords} />
  </>
}

// ── Locations: the kind, the Place tool and the find, the places as rows ──

/** The Locations under the kind `palace` (T-PALACES-ONTO-ATLAS): the world's palaces, each where its door stands — the first room on its
 * path whose subjects are placed (palaces/palacesModel.ts palaceLocationRows). A press turns the Earth to the door; a double-click enters. */
function PalaceLocations({handle, query}: {handle: AtlasHandle | null; query: string}) {
  const standing = useSuiteStanding()
  const {rows, load} = usePalaces()
  const [chosen, setChosen] = useState<string | null>(null)
  useEffect(() => { readPalaces() }, [])
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const shown = palaceLocationRows(rows, standing.places).filter(row => words.every(word => row.name.toLocaleLowerCase().includes(word)))
  const waiting = palacesWaiting(load, rows.length)
  return <PlateRows label="Palaces" size={4} active={chosen} empty={waiting ?? 'No palace of your world matches.'} emptyWord={waiting ? 'reading' : 'none'}
    rows={shown.map(row => ({id: row.key, name: row.name, mark: <Icon name="palace" size={10} />, note: row.door ? `↧ ${row.door.place.name}` : 'not on the Earth', dim: !row.door,
      does: `${row.line}. Press to turn the Earth to its door; double-click to enter it.`}))}
    onPress={key => { setChosen(key); const row = shown.find(candidate => candidate.key === key); if (handle && row?.door) turnAtlasTo(handle, row.door.place) }}
    onOpen={key => { const palace = rows.find(candidate => candidate.key === key); if (palace) void enterPalace(palace) }} />
}

/** What the owners returned for the Earth (provider/suiteStanding.ts SuiteStanding), as readouts and a light: the subjects read, those on
 * the Earth, those no owner places, those undated; the light is the owners' inputs — lit while every one answered, orange when one did
 * not, hollow while they are read. Its sentence (describeStanding) is the status bar's. */
function OwnersReturned() {
  const standing = useSuiteStanding()
  if (standing.phase === 'idle') return null
  const {counts} = standing
  const words = describeStanding(standing) || 'Every owner answered.'
  const short = standing.phase === 'reading' ? 'reading' : standing.phase === 'unavailable' || standing.refused.length || Object.values(standing.inputs).some(input => input.state !== 'available') ? 'partial' : 'read'
  // The light alone (manual §16.10 Light: "A small round light"): lit green while every owner answered, orange when one did not, hollow
  // while they are read; its words, and the undated count, are the status bar's.
  return <div className="plate-keys places-returned" data-places-standing={standing.phase} data-owners={short} data-i={said('What the owners returned', words)}>
    <Lamp state={short === 'reading' ? 'unknown' : 'lit'} tone={short === 'partial' ? 'stall' : 'green'} label={`The owners: ${short}`} />
    <Readout label="subjects" value={counts.subjects} does="Subjects read from their owners." />
    <Readout label="placed" value={counts.located} does="Subjects an owner places on the Earth." />
    <Readout label="unplaced" value={counts.unlocated} does="Subjects no owner places: the Earth draws them nowhere." />
  </div>
}

/** Your system's worlds and where each lands on your planet (T-WORLDS §5 W3), in a section of their own so the band shows them like any
 * section (r19: stacked under the place list they stood below the band's fold, and no world could be landed). */
export function WorldsSection() {
  const tool = useSyncExternalStore(subscribePlaceTool, placeToolState, placeToolState)
  const system = useSyncExternalStore(subscribeSystem, systemReading, systemReading)
  // Escape gives an armed landing back here too: a folded section is not mounted, so Locations' own key may not stand (r20)
  useEffect(() => {
    if (tool.phase !== 'landing') return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') disarmPlaceTool() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool.phase])
  // the landing's line and its owner's answer, said where it was pressed (r20: with Locations folded, a refused landing said nothing)
  const said = tool.phase === 'landing' ? {name: tool.target.name, text: `Click your planet where ${tool.target.name} lands. Esc stops.`, word: 'armed', tone: 'landing'}
    : tool.phase === 'saving' ? {name: tool.target.name, text: `${tool.target.name}’s landing is with its owner.`, word: 'saving', tone: 'saving'}
      : tool.phase === 'idle' && tool.world && tool.notice ? {name: tool.world.name, text: tool.notice, word: tool.tone === 'refused' ? 'refused' : 'saved', tone: tool.tone ?? undefined}
        : null
  const line = said && <PlateLine text={said.text} word={said.word} name={said.name} tone={said.tone} />
  if (system.state !== 'read' || !system.bodies.some(body => !body.yours)) {
    return <>
      <PlateLine text={system.state === 'read' ? 'Today\'s set holds no world but yours: bring one in on Central\'s tracks to land it here.' : 'Your system is read while the Earth stands.'} word="none" name="Worlds" />
      {line}
    </>
  }
  return <>
    {/* [T-WORLDS §5 W3] the worlds of today's set and where each lands on your planet: a press arms the tool to land it, and the next
        click on your planet is its landing, which that world's own body owner writes (system/SystemReadings.tsx landWorld) */}
    <PlateRows label="Worlds" size={3}
      active={tool.phase === 'landing' || tool.phase === 'saving' ? tool.target.key : null}
      rows={system.bodies.filter(body => !body.yours).map(body => ({id: body.key, name: body.world.name, mark: <Icon name="placed" size={10} />,
        note: body.landing ? `${body.landing.lat.toFixed(1)}, ${body.landing.lon.toFixed(1)}` : 'land', dim: !body.landing,
        disabled: body.state === 'reading' || body.state === 'refused',
        does: `${body.world.name}: ${body.standing}; ${body.landing ? 'lands on your planet here' : body.unlanded ?? ''}. Press, then click your planet, to land it there.`}))}
      onPress={key => { const body = system.bodies.find(entry => entry.key === key); if (body) armLanding({key: body.key, name: body.world.name}) }} />
    {line}
    {/* A landing is undone as it is made: a landed world, pressed, either moves (click your planet) or comes off your planet here, its
        body kept without the landing (system/SystemReadings.tsx unlandWorld). */}
    {tool.phase === 'landing' && system.state === 'read' && system.bodies.find(body => body.key === tool.target.key)?.landing && <div className="plate-span plate-tool-row">
      <Action label="Off your planet" does={`Take ${tool.target.name} off your planet: its body is kept whole, without a landing, written on its own register on the revision read. Or click your planet to move it there.`}
        onPress={() => void unlandArmed()} />
    </div>}
  </>
}

function LocationsSection({handle}: {handle: AtlasHandle | null}) {
  const standing = useSuiteStanding()
  const tool = useSyncExternalStore(subscribePlaceTool, placeToolState, placeToolState)
  const kind = useSyncExternalStore(subscribePlaceTool, placeKindChoice, placeKindChoice)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [windowSaid, setWindowSaid] = useState<string | null>(null)
  const rows = useMemo(() => placeRows(standing.places), [standing.places])
  const shown = useMemo(() => findPlaceRows(rows, query), [rows, query])
  const field: SearchResult[] = useMemo(() => (handle && query.trim() ? search(handle.ctl.searchIndex, query, 5) : []), [handle, query])
  const subject = selectedSubject(handle)
  const chosenRow = rows.find(row => row.ref === chosen) ?? null
  const counts = precisionCounts(rows)
  // Escape gives the tool back, as the frame map's context menu closed on Escape
  useEffect(() => {
    if (tool.phase !== 'armed' && tool.phase !== 'landing') return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') disarmPlaceTool() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool.phase])
  const press = () => {
    if (tool.phase === 'armed') { disarmPlaceTool(); return }
    const moving = chosenRow && subject && chosenRow.subject_ref === subject.ref && chosenRow.located && chosenRow.lat !== undefined && chosenRow.lon !== undefined
      ? {place_ref: chosenRow.ref, name: chosenRow.name, lat: chosenRow.lat, lon: chosenRow.lon, precision: chosenRow.precision, ...(chosenRow.evidence ? {evidence: chosenRow.evidence} : {})}
      : undefined
    const armed: PlaceToolSubject | null = subject ? {...subject, ...(moving ? {moving} : {})} : null
    armPlaceTool(handle ? armed : null)
  }
  const turn = (ref: string) => {
    setChosen(ref)
    setWindowSaid(null)
    if (handle) turnAtlasTo(handle, standing.places.find(place => place.ref === ref))
  }
  const line = tool.phase === 'armed'
    ? `Click the body to place ${tool.subject.moving ? `${tool.subject.moving.name} anew` : 'a point'} for ${tool.subject.title}. Esc stops.`
    : tool.phase === 'landing' ? `Click your planet where ${tool.target.name} lands. Esc stops.`
      : tool.phase === 'saving' ? `${tool.target.name}’s landing is with its owner.`
        : tool.phase === 'offered' ? `${draftLine(tool.draft)}. ${tool.notice}` : tool.notice
  // The tool's state in one word, its whole line the status bar's (manual §16.9).
  const toolWord = tool.phase === 'armed' || tool.phase === 'landing' ? 'armed' : tool.phase === 'saving' ? 'saving' : tool.phase === 'offered' ? 'offered' : tool.tone === 'refused' ? 'refused' : 'placed'
  const placeDoes = (kind === 'palace' ? 'A palace stands where its rooms\' subjects are placed: placing a subject a room holds places that room. ' : '')
    + (subject ? `Place a point for ${subject.title}: the next click on the Earth is offered to its time-and-place editor, never written here.` : 'Choose a subject on the Earth first: a place is declared by a subject.')
  const placeRowsShown: PlateRow[] = [
    ...shown.map(row => ({id: row.ref, name: row.name, mark: <PrecisionMark marker={row.marker} title={row.markerNote} />, tag: <StandingTag standing={row.standing} />,
      note: row.located ? row.relation ?? row.kind : 'not on the Earth', dim: !row.located,
      does: [row.relation ?? '', row.markerNote, row.uncertainty ?? '', row.validity ? `valid ${row.validity}` : '', row.reason ?? '', row.provenance].filter(Boolean).join(' · ')})),
    ...field.map(result => ({id: `field:${result.key}`, name: result.label, mark: <Icon name="search" size={10} />, note: 'in the field', does: `${result.label} · ${result.sub}. Press to choose it on the Earth.`})),
  ]
  return <>
    <PlateRadio inline label="Kind" does="What the locations list: places, declared by their subjects; or palaces, each standing where its rooms' subjects are placed."
      value={kind} options={KINDS.map(entry => ({value: entry.id, label: entry.id, why: entry.why}))}
      onChange={id => { if (id === 'place' || id === 'palace') choosePlaceKind(id) }} />
    <div className="plate-span plate-tool-row">
      <Toggle label="✎ Place" does={subject || tool.phase === 'armed' ? placeDoes : 'Place a point for the subject the Earth has selected.'} on={tool.phase === 'armed'} onChange={press}
        disabled={subject || tool.phase === 'armed' ? undefined : 'Choose a subject on the Earth first: a place is declared by a subject.'} />
      <PlateField label="Find a place or anything in the field" does="Narrows the list as you type; the field's own search answers below the places." value={query}
        placeholder={kind === 'palace' ? 'Find a palace…' : 'Find a place…'} onChange={setQuery} />
    </div>
    <PlateLine text={line} word={toolWord} name="Place" tone={tool.phase === 'idle' ? tool.tone ?? undefined : tool.phase}>{tool.phase === 'offered' && <button type="button" data-i="Open the editor|Open the subject's time-and-place editor with the offered point." onClick={openOfferedEditor}>editor</button>}</PlateLine>
    {kind === 'palace' ? <PalaceLocations handle={handle} query={query} />
      : <PlateRows label={counts.length ? counts.map(entry => `${entry.precision} ${entry.count}`).join(' · ') : undefined} size={4} active={chosen} rows={placeRowsShown}
          empty={rows.length ? 'No place of your world matches.' : standing.phase === 'reading' ? 'Reading your world…' : 'No owner declares a place yet.'}
          emptyWord={rows.length ? 'no match' : standing.phase === 'reading' ? 'reading' : 'none'}
          onPress={id => { if (id.startsWith('field:')) { const result = field.find(entry => `field:${entry.key}` === id); if (result) handle?.ctl.chooseResult(result) } else turn(id) }} />}
    {chosenRow
      ? <div className="plate-keys places-chosen">
          <PlateLine text={`${chosenRow.provenance}${chosenRow.validity ? ` · valid ${chosenRow.validity}` : ''}${chosenRow.reason ? ` · ${chosenRow.reason}` : ''}${windowSaid ? ` · ${windowSaid}` : ''}`}
            word="source" name={chosenRow.name} tone={windowSaid ? 'saved' : undefined} />
          {chosenRow.validity && <Action label="Window" does="Set this work's shared window to the place's own validity: the Timeline and the Earth stand in it (lane-4 T23)."
            onPress={() => setWindowSaid(writeSharedWindow(disclosureSession, {from: chosenRow.valid_from ?? null, to: chosenRow.valid_to ?? null}) ?? 'The shared window is the place\'s validity now.')} />}
        </div>
      : <OwnersReturned />}
  </>
}

// ── Relations: which relations the Earth draws ──

function RelationsSection({handle}: {handle: AtlasHandle | null}) {
  const standing = useSuiteStanding()
  const relations = useMemo(() => relationRows(standing.places), [standing.places])
  const within = useMemo(() => withinRows(standing.places), [standing.places])
  const routes = useMemo(() => routeRows(standing.places), [standing.places])
  const filter: FieldFilter = handle?.ctl.fieldFilter ?? {}
  const narrowed = (row: RelationRow) => filter.kinds?.length === 1 && filter.kinds[0] === row.locus
  const narrow = (relation: string) => {
    const row = relations.find(entry => entry.relation === relation)
    if (!handle || !row) return
    const {kinds: _kinds, ...rest} = handle.ctl.fieldFilter
    handle.ctl.setFilter(narrowed(row) ? rest : {...rest, kinds: [row.locus]})
  }
  const narrowedAny = !!filter.kinds?.length
  const rows: PlateRow[] = [
    ...relations.map(row => ({id: row.relation, name: row.relation, mark: <span className="places-swatch" data-standing={row.standing} />, tag: <StandingTag standing={row.standing} />,
      note: `${row.located}/${row.count} · ${LOCUS_WORDS[row.locus] ?? row.locus}`, disabled: !handle,
      does: `${row.relation}: ${row.count} place${row.count === 1 ? '' : 's'}, ${row.located} on the Earth. Press to draw only the ${LOCUS_WORDS[row.locus] ?? row.locus} it is read as.`})),
    ...within.map(row => ({id: `within:${row.child}>${row.parent}`, name: `${row.childName} in ${row.parentName}`, mark: <Icon name="trav" size={10} />, note: row.relation, disabled: true,
      does: `${row.child} ${row.relation} ${row.parent}: listed, not drawn`})),
    ...routes.map(row => ({id: `route:${row.subject_ref}`, name: row.subject_ref, mark: <Icon name="journey" size={10} />, note: row.walkable ? `walk · ${row.stops} stops` : 'one stop: no walk', disabled: true,
      does: row.walkable ? `${row.subject_ref} travelled through ${row.stops} places: the Earth walks them in date order when its thread is followed` : `${row.subject_ref} has one located TRAVELLED_TO place: a walk needs two, so none is drawn`})),
  ]
  return <>
    <PlateRadio inline label="Relations" does="Which places the Earth draws: every relation, or the one pressed below. The same filter as the atlas's own."
      value={narrowedAny ? 'narrowed' : 'all'} options={[{value: 'all', label: 'all'}, {value: 'narrowed', label: 'narrowed', why: narrowedAny ? null : 'Press a relation below to narrow the Earth to it.'}]}
      onChange={handle ? id => { if (id === 'all') { const {kinds: _kinds, ...rest} = handle.ctl.fieldFilter; handle.ctl.setFilter(rest) } } : undefined} />
    <PlateRows rows={rows} size={5} active={relations.filter(narrowed).map(row => row.relation)} onPress={narrow} empty="No owner relates a place yet." />
  </>
}

// ── Earth layers and the frames the Earth stands in ──

function LayersSection({handle}: {handle: AtlasHandle | null}) {
  const lit = handle?.engine.sky?.sunKnown
  return <>
    <PlateRadio inline label="Imagery" does="The atlas's own imagery: NASA Blue Marble, with NASA GIBS tiles close in (globe/earth.ts, globe/tiles.ts). One season: the time window narrows what is placed, never the imagery (no time-dimension imagery source is disclosed)." value="offline"
      options={[{value: 'offline', label: 'Offline'}, {value: 'live', label: 'Live', why: 'No live imagery source is disclosed with your consent yet.'}]} />
    <PlateRadio inline label="Terrain" does="no terrain source is disclosed: the globe draws no relief it has not been given, never a fake horizon (lane-4 T5)." value="off"
      options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On', why: 'No terrain source is disclosed.'}]} />
    <PlateRadio inline label="Day/night" does={!handle ? NOT_MOUNTED : lit ? 'Lit by the sky\'s Sun: a reading of the sky, not a switch.' : 'The sky is not loaded: evenly lit. A reading of the sky, not a switch.'} value={!handle ? null : lit ? 'on' : 'off'}
      options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On'}]} />
  </>
}

function FramesSection({handle}: {handle: AtlasHandle | null}) {
  const sun = useAtlasSun()
  const windowLine = useWindowLine()
  const standing = useSuiteStanding()
  const located = standing.counts.located, places = standing.places.filter(place => place.kind === 'declared')
  const walks = routeRows(standing.places).filter(row => row.walkable).length
  // The reference-frame ladder, rung by rung (the frame map's layers panel, world.ts referenceFrameLadder's labels), each read from
  // what the Earth holds: the Sun, the window, the places the owners declare, their walks, and Nara, which no owner discloses here.
  const ladder = [
    {label: 'solar / planetary system', line: sun?.placed && handle ? 'the QL Sun' : 'no Sun placed', present: !!sun?.placed && !!handle},
    {label: 'Earth / shared world occasion', line: windowLine, present: windowLine !== 'all time'},
    {label: 'historical / current geography', line: places.length ? `${places.length} place${places.length === 1 ? '' : 's'} declared` : 'no place declared', present: places.length > 0},
    {label: 'region / place / route', line: `${located} on the Earth · ${walks} walk${walks === 1 ? '' : 's'}`, present: located > 0},
    {label: 'Nara / current situated body', line: 'no owner discloses it here', present: false},
  ]
  return <PlateRows size={5} rows={ladder.map(rung => ({id: rung.label, name: rung.label.split(' / ')[0]!, mark: <span className="dp-lamp" data-light={rung.present ? 'lit' : 'dark'} data-tone="value" />,
    note: rung.line, dim: !rung.present, does: `${rung.label}: ${rung.line}`}))} />
}

/** The order the sections fold in when the row is too narrow: the manual's further groups first (the frames, the Earth's layers, the
 * view), then Relations, then the builder; the mockup's Body, Landmass, Climate, Sky and Locations stand longest (:1447-1461). */
const FOLD_ORDER = ['frames', 'layers', 'view', 'relations', 'climate', 'sky', 'landmass', 'worlds', 'locations']

/** The M4′ World / Places plate over the open atlas. `held` are the devices the families declare this instrument holds (the globe,
 * the Earth ⇄ Graph switch, the QL sky): each stands as a mark on the section that draws its controls — none is dropped. */
export function PlacesPlate({held, focused, onFold, onFull}: Pick<OwnPlateProps, 'held' | 'focused' | 'onFold' | 'onFull'>) {
  const handle = useAtlasLive()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const standing = useSuiteStanding()
  const inSection = (faces: readonly string[]) => heldMarksOf(held.filter(entry => faces.includes(entry.face)))
  const placed = ['globe-engine', 'mode-switch', 'sky']
  const others = heldMarksOf(held.filter(entry => !placed.includes(entry.face)))
  const located = standing.counts.located, unlocated = standing.places.filter(place => !place.located).length
  const presentation: FacePresentation = {family: 'techne', faceId: 'techne:m4', title: 'World / Places', icon: 'placed',
    owner: ['M4′', 'Technē', 'Earth · root anchor', focused ? 'open on the focused pane' : 'opened here'].join(' · ')}
  const well = wellSection('techne:m4')
  const sections: PlateSection[] = [
    {id: 'body', title: 'Body', cols: 2, note: <HeldMarks devices={[...inSection(['globe-engine', 'mode-switch']), ...others]} />, children: <BodySection />},
    {id: 'landmass', title: 'Landmass', cols: 3, children: <LandmassSection />},
    {id: 'climate', title: 'Climate', cols: 2, children: <ClimateSection />},
    {id: 'sky', title: 'Sky', cols: 3, note: <HeldMarks devices={inSection(['sky'])} />, children: <SkySection handle={handle} />},
    {id: 'locations', title: 'Locations', width: 264, note: standing.phase === 'idle' ? '—' : `${located} placed · ${unlocated}`, children: <LocationsSection handle={handle} />},
    {id: 'worlds', title: 'Worlds', width: 220, children: <WorldsSection />},
    {id: 'relations', title: 'Relations', width: 224, children: <RelationsSection handle={handle} />},
    {id: 'view', title: 'View', width: 196, children: <ViewSection handle={handle} />},
    {id: 'layers', title: 'Earth layers', width: 178, children: <LayersSection handle={handle} />},
    {id: 'frames', title: 'Frames', width: 220, children: <FramesSection handle={handle} />},
  ]
  const fit = usePlateFit([...(well ? [well.id] : []), ...sections.map(section => section.id)].join('|'), FOLD_ORDER)
  return <InstrumentPlate presentation={presentation} fit={fit} onFold={onFold} onFull={onFull} fullLabel="Open World / Places on the focused pane"
    sections={[...(well ? [well] : []), ...sections.map(section => ({...section, folded: fit.folded.has(section.id), onFold: () => fit.press(section.id)}))]}
    dataAttributes={{'data-instrument': 'techne:m4', 'data-expanded': 'true', 'data-places-plate': 'true', 'data-scale': scale ?? undefined}} />
}
