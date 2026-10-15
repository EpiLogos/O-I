// The M4′ World / Places instrument, open on the rack (T-PLACES-ONTO-ATLAS; FOUNDATION §4 "Places is the Archetypal-Earth atlas,
// alone"; lock §2.5 M4′ "planet builder: body, landmass, climate, sky, locations, relations; scales system · body · region ·
// palace"; the mockup's M4 plate, world-shell-mockup.html:1447-1461 `deviceDetail` k==='M4'). One plate, its controls in the
// mockup's six sections; the atlas pane itself carries no chrome (owner, 14 Oct: "controls live in device UI, never as chrome
// inside a pane").
//
// The body is Earth, the one world nobody built (manual §2): the mockup's own Earth branch says "Earth is given — its land is not
// built" (:1449), so Landmass and Climate are readings and the planet builder's knobs are not drawn — no owner builds a body in this
// suite (PATH §7: "the mockup's invented … planet-builder controls have no owner"). What the plate shows is only what the owners
// return: the suite's places (provider/suiteStanding.ts), the QL owner's Sun (the attach's Sun reading), the atlas's own state.
// What it writes goes through the owners: a press on a place turns the Earth (the atlas's own navigation), a Relations row narrows
// the globe through the atlas's one filter (shell/filter.ts), the find chooses through the field's own search (data/search.ts), and
// Place offers a draft to the subject's time-and-place editor (placeTool.ts) — the plate never writes a coordinate.
import {useEffect, useMemo, useState, useSyncExternalStore, type ReactNode} from 'react'
import {InstrumentPlate, SectionDevices, SectionNote, type PlateSection, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {IconName} from '../../../inhabitants/sdk/icons'
import type {FacePresentation} from '../../../inhabitants/sdk/define'
import {useAtlasHandle, useAtlasSun, useSuiteStanding} from '../AtlasProjectionPanel'
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
import {armPlaceTool, disarmPlaceTool, draftLine, openOfferedEditor, placeToolState, subscribePlaceTool, type PlaceToolSubject} from './placeTool'
import './placesPlate.css'

/** The QL family's Sun is drawn on the Earth but is no subject a place can be declared for. */
const SKY_FAMILY = 'ql-sky-subsolar'

/** The mockup's location kinds (`pl.kind`): only a place has an owner that declares it; the others say why they wait. */
const KINDS: readonly {id: string; mark: IconName; why: string | null}[] = [
  {id: 'place', mark: 'placed', why: null},
  {id: 'palace', mark: 'palace', why: 'A palace is a place you enter (N4): no owner builds one on the atlas yet.'},
  {id: 'portal', mark: 'direct', why: 'A portal leads through to another world: no owner opens one yet.'},
  {id: 'route', mark: 'journey', why: 'A route is the walk of a subject\'s TRAVELLED_TO places, each declared as a place.'},
]

/** The words for a locus, as the atlas's own kind filter names it (shell/filter.ts KIND_LABELS' sense, in plain words). */
const LOCUS_WORDS: Partial<Record<LocusType, string>> = {
  'historical-event': 'events', 'myth-episode': 'myth', artifact: 'placed things', sky: 'sky',
}

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

/** One segmented reading or choice in the SDK's own look (sdk.css .sdk-seg): each choice lit only when it is the reading. */
function Segmented({title, values, on, hint, onChoose}: {title: string; values: readonly {id: string; label: ReactNode; why?: string | null}[]; on: string | null; hint?: string; onChoose?: (id: string) => void}) {
  return <div className="sdk-row sdk-row--tog places-seg" title={hint}>
    <span className="sdk-row__name">{title}</span>
    <div className="sdk-seg" role="radiogroup" aria-label={title}>
      {values.map(value => <button key={value.id} type="button" role="radio" aria-checked={on === value.id}
        className={`sdk-seg__opt${on === value.id ? ' sdk-seg__opt--on' : ''}`} disabled={!onChoose || !!value.why}
        title={value.why ?? undefined} onClick={() => onChoose?.(value.id)}>{value.label}</button>)}
    </div>
  </div>
}

/** A reading: its name, and its value in the owner's words. */
function Reading({name, value, title}: {name: string; value: ReactNode; title?: string}) {
  return <div className="places-kv" title={title}><span className="places-k">{name}</span><span className="places-v">{value}</span></div>
}

/** The precision grammar's mark (solid · halo · outline · no-coordinate), as the Earth draws each class (globe/presences.ts). */
function PrecisionMark({marker, title}: {marker: string; title: string}) {
  return <span className="places-prec" data-marker={marker} title={title} aria-label={title} role="img" />
}

function StandingTag({standing}: {standing: PlaceRow['standing']}) {
  return standing === 'mythic' ? <span className="places-tag" data-standing="mythic" title="Mythic: a place of the story, never a historical locus">mythic</span> : null
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
function LensRow({handle}: {handle: AtlasHandle | null}) {
  const current: LensId | null = handle ? lensOf(handle.ctl.state) : null
  const offered = LENSES.filter(lens => BUILT.has(lens.id))
  return <label className="places-kv" title={offered.find(lens => lens.id === current)?.blurb ?? 'The atlas\'s readings of its field: they stand once the Earth is open.'}>
    <span className="places-k">Lens</span>
    <select className="places-select" value={current ?? ''} disabled={!handle} aria-label="The atlas's lens"
      onChange={event => handle?.ctl.openLens(event.target.value as LensId)}>
      {!handle && <option value="">—</option>}
      {offered.map(lens => <option key={lens.id} value={lens.id}>{lens.label}</option>)}
    </select>
  </label>
}

function BodySection({handle, entries}: {handle: AtlasHandle | null; entries: readonly SectionDevice[]}) {
  return <>
    <Segmented title="Body" values={[{id: 'central', label: 'Central', why: 'Your own body has no builder in this suite yet: the atlas draws Earth.'}, {id: 'earth', label: 'Earth'}]}
      on="earth" hint="Earth, the one world nobody built: your root anchor." />
    <Reading name="Name" value="Earth" />
    <Reading name="Seed" value="—" title="Earth is given, so it has no seed to reroll." />
    <LensRow handle={handle} />
    {entries.length > 0 && <SectionDevices label="Body" devices={entries} />}
  </>
}

function SkySection({handle, entries}: {handle: AtlasHandle | null; entries: readonly SectionDevice[]}) {
  const sun = useAtlasSun()
  const windowLine = useWindowLine()
  const standing = useSuiteStanding()
  const sunWords = !handle || !sun ? 'The Sun is read once the Earth stands.'
    : sun.line ?? (sun.placed ? 'Drawn overhead where the QL owner states it, for the instant the Earth shows.' : 'Not placed.')
  const lit = handle?.engine.sky?.sunKnown
  const located = standing.counts.located, places = standing.places.filter(place => place.kind === 'declared')
  const walks = routeRows(standing.places).filter(row => row.walkable).length
  // The reference-frame ladder, rung by rung (the frame map's layers panel, world.ts referenceFrameLadder's labels), each read from
  // what the Earth holds: the Sun, the window, the places the owners declare, their walks, and Nara, which no owner discloses here.
  const ladder: {label: string; line: string; present: boolean}[] = [
    {label: 'solar / planetary system', line: sun?.placed ? 'the QL Sun' : 'no Sun placed', present: !!sun?.placed},
    {label: 'Earth / shared world occasion', line: windowLine, present: windowLine !== 'all time'},
    {label: 'historical / current geography', line: places.length ? `${places.length} place${places.length === 1 ? '' : 's'} declared` : 'no place declared', present: places.length > 0},
    {label: 'region / place / route', line: `${located} on the Earth · ${walks} walk${walks === 1 ? '' : 's'}`, present: located > 0},
    {label: 'Nara / current situated body', line: 'no owner discloses it here', present: false},
  ]
  return <>
    <Reading name="Sun" value={sunWords} />
    <Reading name="Day and night" value={!handle ? '—' : lit ? 'lit by the sky\'s Sun' : 'the sky is not loaded: evenly lit'} />
    <ol className="places-ladder" aria-label="Frames">
      {ladder.map(rung => <li key={rung.label} data-present={rung.present ? 'true' : 'false'} title={rung.label}><span className="places-k">{rung.label.split(' / ')[0]}</span><span className="places-v">{rung.line}</span></li>)}
    </ol>
    {entries.length > 0 && <SectionDevices label="Sky" devices={entries} />}
  </>
}

function LocationsSection({handle}: {handle: AtlasHandle | null}) {
  const standing = useSuiteStanding()
  const tool = useSyncExternalStore(subscribePlaceTool, placeToolState, placeToolState)
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
    if (tool.phase !== 'armed') return
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
  const turn = (row: PlaceRow) => {
    setChosen(row.ref)
    setWindowSaid(null)
    if (handle) turnAtlasTo(handle, standing.places.find(place => place.ref === row.ref))
  }
  const line = tool.phase === 'armed'
    ? `Click the Earth to place ${tool.subject.moving ? `${tool.subject.moving.name} anew` : 'a point'} for ${tool.subject.title}. Esc stops.`
    : tool.phase === 'offered' ? `${draftLine(tool.draft)}. ${tool.notice}` : tool.notice
  return <>
    <Segmented title="Kind" values={KINDS.map(kind => ({id: kind.id, label: <><Icon name={kind.mark} size={10} /> {kind.id}</>, why: kind.why}))} on="place"
      hint="What the next placed location is: a place, declared by its subject." />
    <div className="places-row">
      <button type="button" className={`places-btn${tool.phase === 'armed' ? ' places-btn--on' : ''}`} aria-pressed={tool.phase === 'armed'}
        title={subject ? `Place a point for ${subject.title}: the next click on the Earth is offered to its time-and-place editor, never written here.` : 'Choose a subject on the Earth first: a place is declared by a subject.'}
        onClick={press}><Icon name="draw" size={11} /> Place</button>
      <input className="places-find" type="search" placeholder="Find a place…" value={query} aria-label="Find a place or anything in the field"
        onChange={event => setQuery(event.target.value)} />
    </div>
    {counts.length > 0 && <div className="places-chips" aria-label="Precision">
      {counts.map(entry => <span key={entry.precision} className="places-chip"><PrecisionMark marker={entry.marker} title={entry.precision} />{entry.precision} {entry.count}</span>)}
    </div>}
    {line && <p className="places-line" role="status" data-tone={tool.phase === 'idle' ? tool.tone ?? undefined : tool.phase}>
      {line}{tool.phase === 'offered' && <> <button type="button" className="places-link" onClick={openOfferedEditor}>Open the editor</button></>}
    </p>}
    <div className="places-list" role="list" aria-label="Locations">
      {shown.map(row => <button key={row.ref} type="button" role="listitem" className={`places-item${row.ref === chosen ? ' on' : ''}`} data-located={row.located ? 'true' : 'false'}
        data-standing={row.standing} onClick={() => turn(row)}
        title={[row.name, row.relation ?? '', row.markerNote, row.uncertainty ?? '', row.validity ? `valid ${row.validity}` : '', row.reason ?? '', row.provenance].filter(Boolean).join('\n')}>
        <PrecisionMark marker={row.marker} title={row.markerNote} />
        <span className="n">{row.name}</span><StandingTag standing={row.standing} />
        <span className="d">{row.located ? row.relation ?? row.kind : 'not on the Earth'}</span>
      </button>)}
      {!shown.length && <SectionNote>{rows.length ? 'No place of your world matches.' : standing.phase === 'reading' ? 'Reading your world…' : 'No owner declares a place yet.'}</SectionNote>}
      {field.length > 0 && <div className="places-field" aria-label="In the field">
        {field.map(result => <button key={result.key} type="button" className="places-item" onClick={() => handle?.ctl.chooseResult(result)} title={`${result.label} · ${result.sub}`}>
          <Icon name="search" size={10} /><span className="n">{result.label}</span><span className="d">{result.sub}</span>
        </button>)}
      </div>}
    </div>
    {standing.phase !== 'idle' && describeStanding(standing) && <p className="places-prov" data-places-standing title="What the owners returned: the world's standing (said here, never over the globe)">{describeStanding(standing)}</p>}
    {chosenRow && <p className="places-prov" title="Where it came from">{chosenRow.provenance}{chosenRow.validity ? ` · valid ${chosenRow.validity}` : ''}{chosenRow.reason ? ` · ${chosenRow.reason}` : ''}
      {chosenRow.validity && <> <button type="button" className="places-link" title="Set this work's shared window to the place's own validity: the Timeline and the Earth stand in it (lane-4 T23)"
        onClick={() => setWindowSaid(writeSharedWindow(disclosureSession, {from: chosenRow.valid_from ?? null, to: chosenRow.valid_to ?? null}) ?? 'The shared window is the place\'s validity now.')}>Window to its validity</button></>}
      {windowSaid && <> · {windowSaid}</>}</p>}
  </>
}

function RelationsSection({handle}: {handle: AtlasHandle | null}) {
  const standing = useSuiteStanding()
  const relations = useMemo(() => relationRows(standing.places), [standing.places])
  const within = useMemo(() => withinRows(standing.places), [standing.places])
  const routes = useMemo(() => routeRows(standing.places), [standing.places])
  const filter: FieldFilter = handle?.ctl.fieldFilter ?? {}
  const narrowed = (row: RelationRow) => filter.kinds?.length === 1 && filter.kinds[0] === row.locus
  const narrow = (row: RelationRow) => {
    if (!handle) return
    const {kinds: _kinds, ...rest} = handle.ctl.fieldFilter
    handle.ctl.setFilter(narrowed(row) ? rest : {...rest, kinds: [row.locus]})
  }
  const narrowedAny = !!filter.kinds?.length
  return <>
    <Segmented title="Relations" values={[{id: 'all', label: 'all'}, {id: 'narrowed', label: 'narrowed', why: 'Press a relation below to narrow the Earth to it.'}]}
      on={narrowedAny ? 'narrowed' : 'all'} onChoose={id => { if (id === 'all' && handle) { const {kinds: _kinds, ...rest} = handle.ctl.fieldFilter; handle.ctl.setFilter(rest) } }}
      hint="Which places the Earth draws: every relation, or the one pressed below. The same filter as the atlas's own." />
    <div className="places-list places-list--relations" role="list" aria-label="Relations">
      {relations.map(row => <button key={row.relation} type="button" role="listitem" className={`places-item${narrowed(row) ? ' on' : ''}`} data-standing={row.standing}
        aria-pressed={narrowed(row)} disabled={!handle}
        title={`${row.relation}: ${row.count} place${row.count === 1 ? '' : 's'}, ${row.located} on the Earth. Press to draw only the ${LOCUS_WORDS[row.locus] ?? row.locus} it is read as.`}
        onClick={() => narrow(row)}>
        <span className="places-swatch" data-standing={row.standing} /><span className="n">{row.relation}</span><StandingTag standing={row.standing} />
        <span className="d">{row.located}/{row.count} · {LOCUS_WORDS[row.locus] ?? row.locus}</span>
      </button>)}
      {within.map(row => <div key={`${row.child}>${row.parent}`} role="listitem" className="places-item places-item--reading" title={`${row.child} ${row.relation} ${row.parent}: listed, not drawn`}>
        <Icon name="trav" size={10} /><span className="n">{row.childName} in {row.parentName}</span><span className="d">{row.relation}</span>
      </div>)}
      {routes.map(row => <div key={row.subject_ref} role="listitem" className="places-item places-item--reading"
        title={row.walkable ? `${row.subject_ref} travelled through ${row.stops} places: the Earth walks them in date order when its thread is followed` : `${row.subject_ref} has one located TRAVELLED_TO place: a walk needs two, so none is drawn`}>
        <Icon name="journey" size={10} /><span className="n">{row.subject_ref}</span><span className="d">{row.walkable ? `walk · ${row.stops} stops` : 'one stop: no walk'}</span>
      </div>)}
      {!relations.length && !within.length && !routes.length && <SectionNote>No owner relates a place yet.</SectionNote>}
    </div>
  </>
}

/** The M4′ World / Places plate over the open atlas. `held` are the devices the families declare this instrument holds (the globe,
 * the Earth ⇄ Graph switch, the QL sky): each stands in its section — none is dropped. */
export function PlacesPlate({held, focused}: {held: readonly (SectionDevice & {face: string})[]; focused: boolean}) {
  const handle = useAtlasLive()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const standing = useSuiteStanding()
  const inSection = (faces: readonly string[]) => held.filter(entry => faces.includes(entry.face))
  const placed = ['globe-engine', 'mode-switch', 'sky']
  const others = held.filter(entry => !placed.includes(entry.face))
  const located = standing.counts.located, unlocated = standing.places.filter(place => !place.located).length
  const presentation: FacePresentation = {family: 'techne', faceId: 'techne:m4', title: 'World / Places', icon: 'placed',
    owner: ['M4′', 'Technē', 'Earth · root anchor', focused ? 'open on the focused pane' : 'opened here', `scale ${scale ?? '—'}`].join(' · ')}
  const sections: PlateSection[] = [
    {id: 'body', title: 'Body', width: 150, children: <BodySection handle={handle} entries={inSection(['globe-engine', 'mode-switch'])} />},
    {id: 'landmass', title: 'Landmass', width: 178, children: <>
      <SectionNote>Earth is given — its land is not built. Place and name locations on it; anchor your body’s locations to it.</SectionNote>
      <Reading name="Imagery" value="NASA Blue Marble, with NASA GIBS tiles close in" title="The atlas's own imagery (globe/earth.ts base textures, globe/tiles.ts tiles)." />
      <Reading name="Terrain" value="no terrain source is disclosed" title="The globe draws no relief it has not been given: never a fake horizon (lane-4 T5)." />
      <SectionNote>One season: the time window narrows what is placed, never the imagery (no time-dimension imagery source is disclosed).</SectionNote>
    </>},
    {id: 'climate', title: 'Climate', width: 104, children: <SectionNote>You cannot reshape Earth.</SectionNote>},
    {id: 'sky', title: 'Sky', width: 190, children: <SkySection handle={handle} entries={inSection(['sky'])} />},
    {id: 'locations', title: 'Locations', note: standing.phase === 'idle' ? 'not read' : `${located} on the Earth · ${unlocated} not`, width: 330, children: <LocationsSection handle={handle} />},
    {id: 'relations', title: 'Relations', children: <RelationsSection handle={handle} />},
    ...(others.length ? [{id: 'held', title: 'Also held', children: <SectionDevices label="Also held" devices={others} />}] : []),
  ]
  return <InstrumentPlate presentation={presentation} sections={sections}
    dataAttributes={{'data-instrument': 'techne:m4', 'data-expanded': 'true', 'data-places-plate': 'true', 'data-scale': scale ?? undefined}} />
}
