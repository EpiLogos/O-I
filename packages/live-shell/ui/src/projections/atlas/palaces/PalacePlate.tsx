// The Palace / Integral Whole instrument, open on the rack (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4; lock §2.5, the Palace "(rooms, path,
// guide, portals)"; the mockup's M5 plate, world-shell-mockup.html:1461 — Rooms, Path (guided · free, the guide), Portals — and its
// device row's folded "M5 Palace / Integral Whole"; manual §17.7 Palace, Whole: "Rooms, Path, Board, Return"). Drawn in the device craft
// (ProjectCentral/docs/1-vision/dlw/DLW.md §16; the panel kit and frame/devices/plateControls.tsx): the rooms and the bookmarks as rows that page, the path,
// the guide and the board as switches, a choice no owner takes yet waiting with why. One plate whose sections carry every control the
// frame's Palace lens had
// (field-studies-journeys/src/palaceInstrument.tsx at fdc302870, which retires): the palace you stand in and the way out, its rooms, its
// path and its walk with the guide and the bookmarks (T17, T24), the integral whole with each region's warrant (T14, T18), the
// composition you save to its Expression (T20), its portals (T16), and the Return (T19). The palace itself is drawn in the Earth
// pane at the atlas's palace scale (PalaceFloor.tsx); this plate holds its controls, and the transport walks it.
//
// Outside, the plate lists the world's palaces — each a register's Expression standing where its rooms' subjects are placed
// (palacesModel.ts) — and the doors the Earth's selection stands at; a press turns the Earth to a palace's door, Enter goes in.
// Every act goes through palaceSession.ts to its owner; this plate writes nothing itself.
//
// The head is the panel kit's (InstrumentPlate.tsx; manual §16.9).
//
// Brought to the catalogue's design (lane W4-Technē; T-COVERAGE §1.4): the Palace's design (techne:palace, catalogue/panels/
// techne__palace.tsx) now heads the Palace's chain on the palace session (techne/devices/palaceBinding.ts), with the floor in its display and
// every control it carries — Room, Start, Back, Next, Path, Order, Guide, Floor, Audience, Snap, Lines, the bookmarks' Name and Keep,
// Propose, Accept, Refuse and Leave. This plate keeps only what the design does not carry yet: the world's palaces and Enter (outside),
// the rooms' Open and the regions' order, empty and remove, the guide's warrant line, the walk locus by locus, the bookmarks' Rename and
// Delete, the Return's attribution and receipt, the portals, the integral whole and the composition.

import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {InstrumentPlate, heldMarksOf, type PlateSection} from '../../../frame/devices/InstrumentPlate'
import {usePlateFit} from '../../../frame/devices/plateFit'
import {HeldMarks, PlateField, PlateLine, PlateReading, PlateRows, said, type PlateRow} from '../../../frame/devices/plateControls'
import {Action} from '../../../inhabitants/sdk/panel'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {FacePresentation} from '../../../inhabitants/sdk/define'
import {palaceComposition} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/palace-state'
import {palaceBookmarkLabel, PALACE_BOOKMARK_NAME_LIMIT} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/bookmarks'
import {PALACE_WIRED_INSTRUMENTS, palaceOpenRoute, palaceRegionName, palaceWholeView} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import {useAtlasHandle, useSuiteStanding} from '../AtlasProjectionPanel'
import type {AtlasHandle} from '../mount'
import {selectedSubject} from '../places/PlacesPlate'
import {turnAtlasTo} from '../places/placesHost'
import {palaceLocationRows, palacesHolding, roomPlaces, type PalaceRoom, type PalaceRow} from './palacesModel'
import {palacesWaiting, readPalaces, usePalaces} from './palacesWorld'
import {
  addAsNewRegion, addRegion, addTo, deleteBookmark, enterPalace, focusedRoom, inside, jumpBookmark, leavePalace,
  moveRegion, moveWalk, openEntry, openRoom, palaceState, removeMember, removeRegion, renameBookmark,
  returnToGround, revert, roomsNow, save, selectRooms, stepWalk, subscribePalace, walkOf,
  type PalaceInside,
} from './palaceSession'
import type {OwnPlateProps} from '../../../inhabitants/ql/devices/TechneDevices'
import '../places/placesPlate.css'
import './palaces.css'

const ROOM_KIND_WORDS: Readonly<Record<PalaceRoom['kind'], string>> = {overview: 'overview', constellation: 'constellation', region: 'region', scene: 'scene'}

/** The mounted atlas, re-read on its own notices (the controller's face notices carry a new selection). */
function useAtlasLive(): AtlasHandle | null {
  const handle = useAtlasHandle()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    return handle.ctl.subscribeFaces(() => setTick(n => n + 1))
  }, [handle])
  return handle
}

function usePalace() {
  return useSyncExternalStore(subscribePalace, palaceState, palaceState)
}

// ── outside: the world's palaces ──────────────────────────────────────────

function PalacesSection({handle, rows}: {handle: AtlasHandle | null; rows: readonly PalaceRow[]}) {
  const {load} = usePalaces()
  const standing = useSuiteStanding()
  const state = usePalace()
  const [chosen, setChosen] = useState<string | null>(null)
  const locations = useMemo(() => palaceLocationRows(rows, standing.places), [rows, standing.places])
  const subject = selectedSubject(handle)
  const doors = useMemo(() => palacesHolding(subject?.ref ?? null, rows), [subject?.ref, rows])
  const waitingLine = palacesWaiting(load, rows.length)
  const turn = (key: string) => {
    setChosen(key)
    const door = locations.find(row => row.key === key)?.door
    if (handle && door) turnAtlasTo(handle, door.place)
  }
  const enter = (key: string) => { const palace = rows.find(candidate => candidate.key === key); if (palace) void enterPalace(palace) }
  const chosenRow = chosen ? locations.find(candidate => candidate.key === chosen) : undefined
  return <>
    <PlateRows label="Palaces of your world" size={5} active={chosen} onPress={turn} onOpen={enter} empty={waitingLine ?? undefined}
      rows={locations.map(row => {
        const palace = rows.find(candidate => candidate.key === row.key)!
        return {id: row.key, name: row.name, mark: <Icon name="palace" size={10} />, note: row.rooms ? `${row.rooms} rooms` : palace.standing.split(':')[0], dim: !row.door,
          does: `${row.name} — ${row.line}. Press to turn the Earth to its door; double-click to enter.`}
      })} />
    {waitingLine && (locations.length > 0 || load.phase === 'refused') && <PlateLine text={waitingLine}>{load.phase === 'refused' && <button type="button" onClick={() => readPalaces()}>Read again</button>}</PlateLine>}
    <div className="plate-keys">
      <Action label="Enter" does={chosenRow ? `Enter ${chosenRow.name}: ${chosenRow.line}.` : 'Choose a palace above, then enter it.'} onPress={chosenRow ? () => enter(chosenRow.key) : undefined}
        disabled={chosenRow ? undefined : 'Choose a palace above first.'} />
      {subject && doors.map(({palace, room}) => <Action key={`${palace.key}:${room.key}`} label={`${room.name} (${palace.title})`}
        does={`${subject.title} stands in ${room.name} of ${palace.title}: enter there.`} onPress={() => void enterPalace(palace, {roomKey: room.key})} />)}
    </div>
    {subject && !doors.length && <PlateLine text={`${subject.title} stands in no room of your palaces.`} />}
    <PlateLine text={state.phase !== 'inside' ? state.line : null} />
  </>
}

// ── inside ────────────────────────────────────────────────────────────────

function RoomsSection({here}: {here: PalaceInside}) {
  const rooms = roomsNow(here)
  const focus = focusedRoom(here)
  const {steps, focus: walkFocus} = walkOf(here)
  const whole = useMemo(() => palaceWholeView(here.reading ?? null), [here.reading])
  const guideLine = walkFocus ? whole.regions.find(region => region.key === walkFocus.region)?.standing.line ?? null : null
  const regionNames = here.regions.map(region => region.name)
  const press = (key: string) => {
    selectRooms([key])
    const at = steps.findIndex(step => step.ref === key)
    if (at >= 0) moveWalk(at)
  }
  const rows: PlateRow[] = rooms.map((room, index) => {
    const region = room.kind === 'region' ? here.regions.findIndex(row => row.name === room.name) : -1
    return {id: room.key, name: room.name, mark: <span className="dp-row-note palace-room-n">{index + 1}</span>, dim: room.kind !== 'region' && !room.members.length,
      note: room.kind === 'region' ? room.holds ? `→ ${room.holds.title}` : 'empty' : `${room.members.length} refs`,
      does: `${room.name} — ${ROOM_KIND_WORDS[room.kind]}${room.key === focus ? ', where the walk stands' : ''}. Press to stand the walk here; double-click to open it.`,
      acts: region >= 0 ? <>
        <button type="button" aria-label={`Move ${room.name} earlier on the path`} disabled={here.busy || region === 0} onClick={() => moveRegion(room.name, -1)}>↑</button>
        <button type="button" aria-label={`Move ${room.name} later on the path`} disabled={here.busy || region === regionNames.length - 1} onClick={() => moveRegion(room.name, 1)}>↓</button>
        {room.holds && <button type="button" aria-label={`Empty ${room.name}`} data-i="Empty|Take its Expression out." disabled={here.busy} onClick={() => removeMember(room.name)}>○</button>}
        <button type="button" aria-label={`Remove ${room.name}`} data-i="Remove|Remove the region (on Save)." disabled={here.busy} onClick={() => removeRegion(room.name)}>×</button>
      </> : undefined}
  })
  return <>
    <PlateRows size={5} rows={rows} active={[...here.selected, ...(focus ? [focus] : [])]} onPress={press} onOpen={openRoom} empty="This palace holds no room yet." />
    {here.guide && guideLine && <PlateLine text={guideLine} tone="guide" />}
  </>
}

/** The walk locus by locus (the Palace device walks it room by room: its Room, Start, Back and Next). */
function WalkSection({here}: {here: PalaceInside}) {
  const {steps, index, focus} = walkOf(here)
  const empty = !steps.length
  return <>
    <div className="plate-keys" role="group" aria-label="The walk">
      <Action label="←" does="The previous locus." onPress={() => stepWalk(-1)} disabled={here.busy || empty ? 'The walk has no step yet.' : undefined} />
      <Action label="→" does="The next locus." onPress={() => stepWalk(1)} disabled={here.busy || empty ? 'The walk has no step yet.' : undefined} />
    </div>
    <PlateReading label="Locus" value={focus ? `${index + 1}/${steps.length} · ${focus.office}` : '—'}
      does={focus ? `Locus ${index + 1} of ${steps.length} · ${focus.office} · ${focus.ref}` : here.reading === undefined ? 'The walk waits for the whole.' : 'Nothing stands in the whole, so the walk focuses nothing.'} />
  </>
}

function BookmarksSection({here}: {here: PalaceInside}) {
  const {steps} = walkOf(here)
  const [renaming, setRenaming] = useState<{ref: string; value: string} | null>(null)
  const office = (bookmark: {region: string; ref: string}) => steps.find(step => step.region === bookmark.region && step.ref === bookmark.ref)?.office ?? bookmark.region
  return <>
    {renaming && <PlateField label={`Rename ${renaming.ref}`} value={renaming.value} maxLength={PALACE_BOOKMARK_NAME_LIMIT} onChange={value => setRenaming({ref: renaming.ref, value})}
      onEnter={() => { if (renaming.value.trim() && renameBookmark(renaming.ref, renaming.value)) setRenaming(null) }} onEscape={() => setRenaming(null)} />}
    <PlateRows size={4} empty="No bookmarks yet. Keep one on the Palace device: its Name, then Keep." onPress={ref => { const bookmark = here.bookmarks.find(entry => entry.ref === ref); if (bookmark) jumpBookmark(bookmark) }}
      rows={here.bookmarks.map(bookmark => ({id: bookmark.ref, name: palaceBookmarkLabel(bookmark), mark: <Icon name="follow" size={10} />, note: office(bookmark),
        does: `Jump to ${bookmark.ref}: the walk, its focus and the floor together.`,
        acts: <>
          <button type="button" aria-label={`Rename ${palaceBookmarkLabel(bookmark)}`} onClick={() => setRenaming({ref: bookmark.ref, value: palaceBookmarkLabel(bookmark)})}>✎</button>
          <button type="button" aria-label={`Delete ${palaceBookmarkLabel(bookmark)}`} onClick={() => deleteBookmark(bookmark)}>×</button>
        </>}))} />
  </>
}

function WholeSection({here}: {here: PalaceInside}) {
  const whole = useMemo(() => palaceWholeView(here.reading ?? null), [here.reading])
  const {focus} = walkOf(here)
  // The whole as a rack's chains (manual §16 "A rack holds several chains"): its regions, one row each with its warrant; a region pressed
  // shows its entries, each opened in its own instrument; ‹ goes back to the regions. Every entry stays one press away, and nothing scrolls.
  const [region, setRegion] = useState<string | null>(null)
  if (here.reading === undefined) return <PlateLine text="Reading the integral whole…" />
  if (!whole.available) return <PlateLine text={whole.reason ? `Unavailable: ${whole.reason}.` : here.readingReason ? `Unavailable: ${here.readingReason}.` : 'The reading is not yet disclosed.'} />
  const shown = whole.regions.find(candidate => candidate.key === region) ?? null
  if (!shown) return <PlateRows size={6} active={focus ? `region:${focus.region}` : null} onPress={id => setRegion(id.slice('region:'.length))}
    rows={whole.regions.map(entry => ({id: `region:${entry.key}`, name: palaceRegionName(entry),
      mark: <span className="palace-standing-mark" data-region={entry.key} data-standing={entry.standing.standing} />, note: `${entry.entries.length} · ${entry.standing.standing}`,
      does: `${entry.standing.line} Press to show its ${entry.entries.length} entr${entry.entries.length === 1 ? 'y' : 'ies'}.`}))} />
  const entryAt = (id: string) => shown.entries.find((entry, index) => id === `entry:${entry.kind}:${entry.ref}:${index}`) ?? null
  return <PlateRows size={6} active={shown.entries.flatMap((entry, index) => focus?.region === shown.key && focus.ref === entry.ref ? [`entry:${entry.kind}:${entry.ref}:${index}`] : [])}
    onPress={id => { if (id === 'back') { setRegion(null); return } const entry = entryAt(id); if (entry) openEntry(entry) }}
    rows={[
      {id: 'back', name: `‹ ${palaceRegionName(shown)}`, mark: <span className="palace-standing-mark" data-standing={shown.standing.standing} />,
        note: shown.standing.standing, does: `${shown.standing.line} Press to go back to every region.`},
      ...shown.entries.map((entry, index) => {
        const route = palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS)
        return {id: `entry:${entry.kind}:${entry.ref}:${index}`, name: entry.ref, note: entry.label, mark: <span className="palace-entry-indent" />,
          does: route.kind === 'refused' ? route.reason : `${entry.ref}${entry.note ? ` · ${entry.note}` : ''} — open in its own instrument`}
      }),
    ]} />
}

function ComposeSection({here}: {here: PalaceInside}) {
  const [name, setName] = useState('')
  const contained = new Set(here.regions.flatMap(region => region.member ? [region.member.expression_ref] : []))
  const open = here.regions.find(region => !region.member)
  const behind = here.doc.revision > here.draftDoc.revision
  return <>
    <div className="plate-tool-row">
      <PlateField label="New region name" value={name} maxLength={80} placeholder="New region…" disabled={here.busy} onChange={setName} onEnter={() => { if (addRegion(name)) setName('') }} />
      <Action label="+ Region" does="Add a region to the palace's path (on Save)." onPress={() => { if (addRegion(name)) setName('') }} disabled={here.busy || !name.trim() ? 'Name the region first.' : undefined} />
    </div>
    <PlateRows size={3} empty={here.eligibleKnown ? 'No other native Expressions are disclosed.' : 'Reading the kernel\'s Expressions…'}
      rows={here.eligible.map(entry => ({id: entry.expression_ref, name: entry.title, mark: <Icon name="expr" size={10} />, does: `${entry.expression_ref} · revision ${entry.revision}`,
        note: contained.has(entry.expression_ref) ? 'composed' : undefined,
        acts: contained.has(entry.expression_ref) ? undefined : <button type="button" className="palace-compose-act" disabled={here.busy}
          onClick={() => open ? addTo(open.name, entry.expression_ref, entry.title) : addAsNewRegion(entry.expression_ref, entry.title)}>{open ? `into ${open.name}` : 'as a region'}</button>}))} />
    {behind && <PlateLine tone="refused" text={`This draft began at revision ${here.draftDoc.revision}; the owner discloses ${here.doc.revision}. Revert takes the current composition.`} />}
    <div className="plate-keys">
      <Action label="Save composition" does="One edit of the palace's Expression, gated on the revision the draft began at." onPress={() => void save()} disabled={here.busy || behind ? 'Revert first: the owner moved on.' : undefined} />
      <Action label="Revert" does="Take the owner's current composition." onPress={revert} disabled={here.busy ? 'Saving.' : undefined} />
    </div>
  </>
}

function PortalsSection({here, handle}: {here: PalaceInside; handle: AtlasHandle | null}) {
  const standing = useSuiteStanding()
  const rooms = roomsNow(here)
  const regions = rooms.filter(room => room.kind === 'region' && room.holds)
  const focus = focusedRoom(here)
  const focused = rooms.find(room => room.key === focus)
  const places = focused ? roomPlaces(focused, standing.places) : []
  // the way back to the ground — the Earth — is the first door out (palaceInstrument.tsx:464 "Return to ground"); a reading that does
  // not disclose the ground leaves the plain way out, saying so
  const ground = !!here.reading && here.reading.disclosure.instruments.some(entry => entry.instrument === 'project' && entry.available)
  const rows: PlateRow[] = [
    {id: 'ground', name: '↩ the Earth', mark: <Icon name="ret" size={10} />, note: ground ? 'ground' : 'leave',
      does: ground ? 'Return to the ground: the Earth (Escape)' : 'The reading does not disclose the ground; leave the palace for the Earth (Escape)'},
    ...regions.map(room => ({id: `room:${room.key}`, name: `→ ${room.holds!.title}`, mark: <Icon name="direct" size={10} />, note: 'Expression', does: `${room.name}: its one contained Expression — open it`})),
    ...places.map(place => ({id: `place:${place.ref}`, name: `→ ${place.name}`, mark: <Icon name="placed" size={10} />, note: 'place', does: `Leave for ${place.name} on the Earth`})),
  ]
  const press = (id: string) => {
    if (id === 'ground') { if (ground) returnToGround(); else leavePalace('Left the palace for the Earth.'); return }
    if (id.startsWith('room:')) { openRoom(id.slice(5)); return }
    const place = places.find(entry => `place:${entry.ref}` === id)
    if (place) { leavePalace(`Left for ${place.name}.`); if (handle) turnAtlasTo(handle, place) }
  }
  return <>
    <PlateRows size={5} rows={rows} onPress={press} />
    {!regions.length && !places.length && <PlateLine text="A region holding an Expression, or a placed subject in the room the walk stands in, is a door out too." />}
  </>
}

function ReturnSection({here}: {here: PalaceInside}) {
  const receipt = here.reading ? palaceComposition(here.reading).receipt : undefined
  const proposal = here.proposal
  // The Palace device proposes, accepts and refuses; this section keeps the owner's words about it: who it is attributed to, where it is
  // routed and under what authority, the receipt an accepted Return left.
  return <>
    {!proposal && receipt && <PlateLine tone="saved" text={receipt} />}
    {proposal && <PlateLine text={proposal.receipt?.routed
      ? `${proposal.attribution} Routed to ${proposal.receipt.action_ref} under ${proposal.receipt.authority ?? 'the owner'}; the native owner decides.`
      : `${proposal.attribution || 'No Return is attributed.'} Not routed: ${proposal.refusal ?? 'the routing law refused it'}.`} />}
    {here.acceptance && <PlateLine tone={here.acceptance.accepted ? 'saved' : 'refused'} text={here.acceptance.line} />}
  </>
}

/** The sections a palace's plate starts with folded (manual §10.4 "A device can also fold down to its title"): inside, the integral
 * whole and the composition, the deeper work, until pressed; outside, the palace's own groups until a palace is entered. The row folds
 * the rest to fit from the end; every control stays one press away. */
export const START_FOLDED_INSIDE: readonly string[] = ['whole', 'compose']
const FOLD_ORDER_INSIDE = ['compose', 'whole', 'portals', 'bookmarks', 'return', 'walk']
const OUTSIDE = ['portals']

/** The Palace / Integral Whole plate. `held` are the devices the families declare this instrument holds: their marks stand on the
 * plate's first section. Entering or leaving a palace stands the plate anew, with that side's sections folded as they start. */
type PalacePlateProps = Pick<OwnPlateProps, 'held' | 'focused' | 'onFold' | 'onFull'> & {startFolded?: readonly string[]}

export function PalacePlate({held, focused, startFolded, onFold, onFull}: PalacePlateProps) {
  const here = inside()
  return <PalacePlateAt key={here ? `inside:${here.palace.key}` : 'outside'} held={held} focused={focused} startFolded={startFolded} onFold={onFold} onFull={onFull} />
}

function PalacePlateAt({held, focused, startFolded, onFold, onFull}: PalacePlateProps) {
  const handle = useAtlasLive()
  const {rows} = usePalaces()
  const state = usePalace()
  const here = inside()
  useEffect(() => { readPalaces() }, [])
  const spoken = here ? !!(here.proposal || here.acceptance || (here.reading && palaceComposition(here.reading).receipt)) : false
  const ids = here ? ['rooms', 'walk', ...(spoken ? ['return'] : []), 'bookmarks', 'portals', 'whole', 'compose'] : ['palaces', ...OUTSIDE]
  const fit = usePlateFit(ids.join('|'), here ? FOLD_ORDER_INSIDE : [...OUTSIDE].reverse(), false, startFolded ?? (here ? START_FOLDED_INSIDE : OUTSIDE))
  const fold = (section: Omit<PlateSection, 'folded' | 'onFold'>): PlateSection => ({...section, folded: fit.folded.has(section.id), onFold: () => fit.press(section.id)})
  const outsideNote = (what: string) => <PlateLine text={`Enter a palace: ${what}`} word="enter" name="Palace" light="unknown" />
  const marks = <HeldMarks devices={heldMarksOf(held)} />
  const presentation: FacePresentation = {family: 'techne', faceId: 'techne:m5', title: 'Palace / Integral Whole', icon: 'palace',
    owner: ['Technē', here ? `${here.palace.title} r${here.doc.revision}` : 'the palaces of your world', focused ? 'open on the focused pane' : 'opened here'].filter(Boolean).join(' · ')}
  const sections: PlateSection[] = [...(here ? [
    fold({id: 'rooms', title: 'Rooms', width: 236, note: <>{`${roomsNow(here).length} along the path`}{marks}</>, children: <RoomsSection here={here} />}),
    fold({id: 'walk', title: 'Walk', width: 160, note: here.walking ? 'walking' : undefined, children: <WalkSection here={here} />}),
    ...(spoken ? [fold({id: 'return', title: 'Return', width: 220, note: here.proposal ? 'proposed' : undefined, children: <ReturnSection here={here} />})] : []),
    fold({id: 'bookmarks', title: 'Bookmarks', width: 210, note: here.bookmarks.length ? `${here.bookmarks.length}` : undefined, children: <BookmarksSection here={here} />}),
    fold({id: 'portals', title: 'Portals', width: 200, children: <PortalsSection here={here} handle={handle} />}),
    fold({id: 'whole', title: 'Integral whole', width: 260, note: here.reading === undefined ? 'reading' : here.reading ? undefined : 'refused', children: <WholeSection here={here} />}),
    fold({id: 'compose', title: 'Compose', width: 250, note: here.busy ? 'saving' : here.regions.length || here.removed.length ? `${here.regions.length} regions` : undefined, children: <ComposeSection here={here} />}),
  ] : [
    fold({id: 'palaces', title: 'Palaces', width: 300, note: <>{state.phase === 'entering' ? 'entering' : `${rows.length}`}{marks}</>, children: <PalacesSection handle={handle} rows={rows} />}),
    fold({id: 'portals', title: 'Portals', width: 170, children: outsideNote('its doors out — to other palaces and to places — stand here.')}),
  ])]
  // the palace's one status line (palaceInstrument.tsx:622 message) stands under the sections, in the owner's words
  const footer = here?.line ? <p className="plate-line palace-plate-line" role="status" data-i={said('Palace', here.line)}>{here.line}</p> : null
  return <InstrumentPlate presentation={presentation} sections={sections} footer={footer} fit={fit} onFold={onFold} onFull={onFull} fullLabel="Open Palace / Integral Whole on the focused pane"
    dataAttributes={{'data-instrument': 'techne:m5', 'data-expanded': 'true', 'data-palace-plate': 'true', 'data-palace': here ? here.palace.key : undefined, 'data-palace-phase': state.phase}} />
}
