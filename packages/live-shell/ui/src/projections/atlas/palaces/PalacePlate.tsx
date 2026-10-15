// The M5′ Palace / Integral Whole instrument, open on the rack (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4; lock §2.5 "M5′ Palace (rooms, path,
// guide, portals)"; the mockup's M5 plate, world-shell-mockup.html:1461 — Rooms, Path (guided · free, the guide), Portals — and its
// device row's folded "M5 Palace / Integral Whole"). One plate whose sections carry every control the frame's Palace lens had
// (field-studies-journeys/src/palaceInstrument.tsx at fdc302870, which retires): the palace you stand in and the way out, its rooms, its
// path and its walk with the guide and the bookmarks (T17, T24), the integral whole with each region's warrant (T14, T18), the
// composition you save to its Expression (T20), its portals (T16), and the Return (T19). The palace itself is drawn in the Earth
// pane at the atlas's palace scale (PalaceFloor.tsx); this plate holds its controls, and the transport walks it.
//
// Outside, the plate lists the world's palaces — each a register's Expression standing where its rooms' subjects are placed
// (palacesModel.ts) — and the doors the Earth's selection stands at; a press turns the Earth to a palace's door, Enter goes in.
// Every act goes through palaceSession.ts to its owner; this plate writes nothing itself.

import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {InstrumentPlate, SectionDevices, SectionNote, type PlateSection, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {FacePresentation} from '../../../inhabitants/sdk/define'
import {palaceComposition} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/palace-state'
import {palaceBookmarkLabel, PALACE_BOOKMARK_NAME_LIMIT} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/bookmarks'
import {PALACE_WIRED_INSTRUMENTS, palaceOpenRoute, palaceWholeView} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import {useAtlasHandle, useSuiteStanding} from '../AtlasProjectionPanel'
import type {AtlasHandle} from '../mount'
import {Segmented, selectedSubject} from '../places/PlacesPlate'
import {turnAtlasTo} from '../places/placesHost'
import {palaceLocationRows, palacesHolding, roomPlaces, type PalaceRoom, type PalaceRow} from './palacesModel'
import {palacesWaiting, readPalaces, usePalaces} from './palacesWorld'
import {
  acceptReturn, addAsNewRegion, addRegion, addTo, bookmarkHere, deleteBookmark, enterPalace, focusedRoom, inside, jumpBookmark, leavePalace,
  moveRegion, moveWalk, openEntry, openRoom, palaceState, proposeReturn, refuseReturn, removeMember, removeRegion, renameBookmark,
  returnToGround, revert, roomsNow, save, selectRooms, setGuide, setPath, setSnap, stepWalk, subscribePalace, walkOf, walkToStart,
  type PalaceInside,
} from './palaceSession'
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

function Line({text, tone}: {text: string | null | undefined; tone?: string}) {
  return text ? <p className="places-line" role="status" data-tone={tone}>{text}</p> : null
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
  const waiting = palacesWaiting(load, rows.length)
  const turn = (key: string) => {
    setChosen(key)
    const door = locations.find(row => row.key === key)?.door
    if (handle && door) turnAtlasTo(handle, door.place)
  }
  return <>
    <div className="places-list" role="list" aria-label="Palaces of your world">
      {locations.map(row => {
        const palace = rows.find(candidate => candidate.key === row.key)!
        return <button key={row.key} type="button" role="listitem" className={`places-item${chosen === row.key ? ' on' : ''}`} data-located={row.door ? 'true' : 'false'}
          title={`${row.name} — ${row.line}. Press to turn the Earth to its door; double-click to enter.`}
          onClick={() => turn(row.key)} onDoubleClick={() => void enterPalace(palace)}>
          <Icon name="palace" size={10} /><span className="n">{row.name}</span><span className="d">{row.rooms ? `${row.rooms} rooms` : palace.standing.split(':')[0]}</span>
        </button>
      })}
      {waiting && <SectionNote>{waiting}{load.phase === 'refused' && <> <button type="button" className="places-link" onClick={() => readPalaces()}>Read again</button></>}</SectionNote>}
    </div>
    {chosen && (() => {
      const row = locations.find(candidate => candidate.key === chosen)
      const palace = rows.find(candidate => candidate.key === chosen)
      return row && palace ? <p className="places-prov">{row.line} <button type="button" className="places-btn" onClick={() => void enterPalace(palace)}><Icon name="palace" size={10} /> Enter</button></p> : null
    })()}
    {subject && <p className="places-prov" title="The doors the Earth's selection stands at: the rooms of your palaces that hold it">
      {doors.length ? <>{subject.title} stands in {doors.map(({palace, room}, index) => <span key={`${palace.key}:${room.key}`}>{index ? ' · ' : ''}<button type="button" className="places-link"
        onClick={() => void enterPalace(palace, {roomKey: room.key})}>{room.name} ({palace.title})</button></span>)}</> : `${subject.title} stands in no room of your palaces.`}
    </p>}
    <Line text={state.phase !== 'inside' ? state.line : null} />
  </>
}

// ── inside ────────────────────────────────────────────────────────────────

function RoomsSection({here}: {here: PalaceInside}) {
  const rooms = roomsNow(here)
  const focus = focusedRoom(here)
  const {steps} = walkOf(here)
  const regionNames = here.regions.map(region => region.name)
  const press = (room: PalaceRoom) => {
    selectRooms([room.key])
    const at = steps.findIndex(step => step.ref === room.key)
    if (at >= 0) moveWalk(at)
  }
  return <>
    <div className="places-list places-list--rooms" role="list" aria-label="Rooms along the path">
      {rooms.map((room, index) => {
        const region = room.kind === 'region' ? here.regions.findIndex(row => row.name === room.name) : -1
        return <div key={room.key} role="listitem" className={`places-item palace-room-row${here.selected.includes(room.key) ? ' on' : ''}`} data-focused={room.key === focus ? 'true' : undefined}
          data-kind={room.kind} title={`${room.name} — ${ROOM_KIND_WORDS[room.kind]}. Press to stand the walk here; double-click to open it.`}
          onClick={() => press(room)} onDoubleClick={() => openRoom(room.key)}>
          <span className="d">{index + 1}</span><span className="n">{room.name}</span>
          <span className="d">{room.kind === 'region' ? room.holds ? `→ ${room.holds.title}` : 'empty' : `${room.members.length} refs`}</span>
          {region >= 0 && <span className="palace-room-acts" onClick={event => event.stopPropagation()}>
            <button type="button" aria-label={`Move ${room.name} earlier on the path`} disabled={here.busy || region === 0} onClick={() => moveRegion(room.name, -1)}>↑</button>
            <button type="button" aria-label={`Move ${room.name} later on the path`} disabled={here.busy || region === regionNames.length - 1} onClick={() => moveRegion(room.name, 1)}>↓</button>
            {room.holds && <button type="button" aria-label={`Empty ${room.name}`} title="Take its Expression out" disabled={here.busy} onClick={() => removeMember(room.name)}>○</button>}
            <button type="button" aria-label={`Remove ${room.name}`} title="Remove the region (on Save)" disabled={here.busy} onClick={() => removeRegion(room.name)}>×</button>
          </span>}
        </div>
      })}
      {!rooms.length && <SectionNote>This palace holds no room yet.</SectionNote>}
    </div>
    <Segmented title="Snap" values={[{id: 'off', label: 'off'}, {id: 'grid', label: 'grid'}]} on={here.snap ? 'grid' : 'off'} onChoose={id => setSnap(id === 'grid')}
      hint="Snap: an authoring aid to the grid when you drag a room on the floor; positions stay free" />
  </>
}

function PathSection({here}: {here: PalaceInside}) {
  const {steps, index, focus} = walkOf(here)
  const whole = useMemo(() => palaceWholeView(here.reading ?? null), [here.reading])
  const guideLine = focus ? whole.regions.find(region => region.key === focus.region)?.standing.line ?? null : null
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<{ref: string; value: string} | null>(null)
  const empty = !steps.length
  const office = (bookmark: {region: string; ref: string}) => steps.find(step => step.region === bookmark.region && step.ref === bookmark.ref)?.office ?? bookmark.region
  return <>
    <Segmented title="Path" values={[{id: 'guided', label: 'guided'}, {id: 'free', label: 'free'}]} on={here.path} onChoose={id => setPath(id as 'guided' | 'free')}
      hint="Guided: the floor draws the path and the walk's focus. Free: the same palace entered directly — the walk stays an ordering, never a gate." />
    <Segmented title="Guide" values={[{id: 'on', label: 'on'}, {id: 'off', label: 'off'}]} on={here.guide ? 'on' : 'off'} onChoose={id => setGuide(id === 'on')}
      hint="The guide says why the focused room stands where it does, from the owner's own warrant (T18)" />
    <div className="places-row" role="group" aria-label="The walk">
      <button type="button" className="places-btn" disabled={here.busy || empty} title="The named start: the walk's first step" onClick={walkToStart}>Start</button>
      <button type="button" className="places-btn" disabled={here.busy || empty} aria-label="Previous locus" onClick={() => stepWalk(-1)}>←</button>
      <button type="button" className="places-btn" disabled={here.busy || empty} aria-label="Next locus" onClick={() => stepWalk(1)}>→</button>
    </div>
    <p className="places-prov" data-palace-walk>{focus ? `Locus ${index + 1} of ${steps.length} · ${focus.office} · ${focus.ref}` : here.reading === undefined ? 'The walk waits for the whole.' : 'Nothing stands in the whole, so the walk focuses nothing.'}</p>
    {here.guide && guideLine && <p className="places-line palace-guide" title="The guide: why this room stands where it does">{guideLine}</p>}
    <div className="places-row">
      <input className="places-find" disabled={here.busy || !focus} value={name} maxLength={PALACE_BOOKMARK_NAME_LIMIT} placeholder="Name this position…" aria-label="Bookmark name"
        onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && name.trim() && bookmarkHere(name)) setName('') }} />
      <button type="button" className="places-btn" disabled={here.busy || !focus || !name.trim()} onClick={() => { if (bookmarkHere(name)) setName('') }}>Bookmark</button>
    </div>
    <div className="places-list" role="list" aria-label="Bookmarks">
      {here.bookmarks.map(bookmark => renaming?.ref === bookmark.ref
        ? <div key={bookmark.ref} role="listitem" className="places-item places-item--reading">
            <input className="places-find" aria-label={`Rename ${palaceBookmarkLabel(bookmark)}`} value={renaming.value} maxLength={PALACE_BOOKMARK_NAME_LIMIT} autoFocus
              onChange={event => setRenaming({ref: bookmark.ref, value: event.target.value})}
              onKeyDown={event => { if (event.key === 'Enter' && renaming.value.trim() && renameBookmark(bookmark.ref, renaming.value)) setRenaming(null); if (event.key === 'Escape') setRenaming(null) }} />
          </div>
        : <div key={bookmark.ref} role="listitem" className="places-item" title={`Jump to ${bookmark.ref}: the walk, its focus and the floor together`} onClick={() => jumpBookmark(bookmark)}>
            <Icon name="follow" size={10} /><span className="n">{palaceBookmarkLabel(bookmark)}</span><span className="d">{office(bookmark)}</span>
            <span className="palace-room-acts" onClick={event => event.stopPropagation()}>
              <button type="button" aria-label={`Rename ${palaceBookmarkLabel(bookmark)}`} onClick={() => setRenaming({ref: bookmark.ref, value: palaceBookmarkLabel(bookmark)})}>✎</button>
              <button type="button" aria-label={`Delete ${palaceBookmarkLabel(bookmark)}`} onClick={() => deleteBookmark(bookmark)}>×</button>
            </span>
          </div>)}
      {!here.bookmarks.length && <SectionNote>No bookmarks yet. Name the focused position above.</SectionNote>}
    </div>
  </>
}

function WholeSection({here}: {here: PalaceInside}) {
  const whole = useMemo(() => palaceWholeView(here.reading ?? null), [here.reading])
  const {focus} = walkOf(here)
  if (here.reading === undefined) return <SectionNote>Reading the integral whole…</SectionNote>
  if (!whole.available) return <SectionNote>{whole.reason ? `Unavailable: ${whole.reason}.` : here.readingReason ? `Unavailable: ${here.readingReason}.` : 'The reading is not yet disclosed.'}</SectionNote>
  return <div className="places-list places-list--whole" role="list" aria-label="Integral whole">
    {whole.regions.map(region => <div key={region.key} role="listitem" className="palace-whole-region" data-region={region.key} data-standing={region.standing.standing}>
      <p className="places-kv" title={region.standing.line}><span className="places-k">{region.m_prime === null ? 'close' : `M′${region.m_prime}`}</span>
        <span className="places-v">{region.office} <span className="places-tag palace-standing" data-standing={region.standing.standing}>{region.standing.standing}</span></span></p>
      {region.entries.map((entry, index) => {
        const route = palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS)
        return <button key={`${entry.kind}:${entry.ref}:${index}`} type="button" className="places-item" data-walk-focus={focus?.region === region.key && focus.ref === entry.ref ? 'true' : undefined}
          title={route.kind === 'refused' ? route.reason : `${entry.ref}${entry.note ? ` · ${entry.note}` : ''} — open in its own instrument`} onClick={() => openEntry(entry)}>
          <span className="n">{entry.ref}</span><span className="d">{entry.label}</span>
        </button>
      })}
    </div>)}
  </div>
}

function ComposeSection({here}: {here: PalaceInside}) {
  const [name, setName] = useState('')
  const contained = new Set(here.regions.flatMap(region => region.member ? [region.member.expression_ref] : []))
  const open = here.regions.find(region => !region.member)
  const behind = here.doc.revision > here.draftDoc.revision
  return <>
    <div className="places-row">
      <input className="places-find" disabled={here.busy} value={name} maxLength={80} placeholder="New region…" aria-label="New region name"
        onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && addRegion(name)) setName('') }} />
      <button type="button" className="places-btn" disabled={here.busy || !name.trim()} onClick={() => { if (addRegion(name)) setName('') }}><Icon name="plus" size={10} /> Region</button>
    </div>
    <div className="places-list" role="list" aria-label="Eligible native Expressions">
      {here.eligible.map(entry => <div key={entry.expression_ref} role="listitem" className="places-item places-item--reading" title={`${entry.expression_ref} · revision ${entry.revision}`}>
        <Icon name="expr" size={10} /><span className="n">{entry.title}</span>
        {contained.has(entry.expression_ref)
          ? <span className="d">composed</span>
          : <button type="button" className="places-link" disabled={here.busy}
              onClick={() => open ? addTo(open.name, entry.expression_ref, entry.title) : addAsNewRegion(entry.expression_ref, entry.title)}>{open ? `into ${open.name}` : 'as a region'}</button>}
      </div>)}
      {!here.eligible.length && <SectionNote>{here.eligibleKnown ? 'No other native Expressions are disclosed.' : 'Reading the kernel\'s Expressions…'}</SectionNote>}
    </div>
    {behind && <p className="places-line" data-tone="refused">This draft began at revision {here.draftDoc.revision}; the owner discloses {here.doc.revision}. Revert takes the current composition.</p>}
    <div className="places-row">
      <button type="button" className="places-btn" disabled={here.busy || behind} title="One edit of the palace's Expression, gated on the revision the draft began at" onClick={() => void save()}>Save composition</button>
      <button type="button" className="places-btn" disabled={here.busy} onClick={revert}>Revert</button>
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
  // the way back to the M0′ ground — the Earth — is the first door out (palaceInstrument.tsx:464 "Return to ground"); a reading that does
  // not disclose the ground leaves the plain way out, saying so
  const ground = !!here.reading && here.reading.disclosure.instruments.some(entry => entry.instrument === 'project' && entry.available)
  return <div className="places-list" role="list" aria-label="Portals">
    <button type="button" role="listitem" className="places-item palace-ground" title={ground ? 'Return to the M0′ ground: the Earth (Escape)' : 'The reading does not disclose the M0′ ground; leave the palace for the Earth (Escape)'}
      onClick={() => ground ? returnToGround() : leavePalace('Left the palace for the Earth.')}>
      <Icon name="ret" size={10} /><span className="n">↩ the Earth</span><span className="d">{ground ? 'ground' : 'leave'}</span>
    </button>
    {regions.map(room => <button key={room.key} type="button" role="listitem" className="places-item" title={`${room.name}: its one contained Expression — open it`} onClick={() => openRoom(room.key)}>
      <Icon name="direct" size={10} /><span className="n">→ {room.holds!.title}</span><span className="d">Expression</span>
    </button>)}
    {places.map(place => <button key={place.ref} type="button" role="listitem" className="places-item" title={`Leave for ${place.name} on the Earth`}
      onClick={() => { leavePalace(`Left for ${place.name}.`); if (handle) turnAtlasTo(handle, place) }}>
      <Icon name="placed" size={10} /><span className="n">→ {place.name}</span><span className="d">place</span>
    </button>)}
    {!regions.length && !places.length && <SectionNote>A region holding an Expression, or a placed subject in the room the walk stands in, is a door out too.</SectionNote>}
  </div>
}

function ReturnSection({here}: {here: PalaceInside}) {
  const receipt = here.reading ? palaceComposition(here.reading).receipt : undefined
  const proposal = here.proposal
  return <>
    <button type="button" className="places-btn" disabled={here.busy || !here.reading} title="Shape the palace's Return as an attributable proposal: nothing is written" onClick={proposeReturn}>Propose Return</button>
    {!proposal && receipt && <p className="places-line" data-tone="saved" role="status">{receipt}</p>}
    {proposal && <>
      <p className="places-prov">{proposal.receipt?.routed
        ? `${proposal.attribution} Routed to ${proposal.receipt.action_ref} under ${proposal.receipt.authority ?? 'the owner'}; the native owner decides.`
        : `${proposal.attribution || 'No Return is attributed.'} Not routed: ${proposal.refusal ?? 'the routing law refused it'}.`}</p>
      <div className="places-row">
        <button type="button" className="places-btn" disabled={here.accepting || here.acceptance?.accepted === true || !proposal.receipt?.routed} onClick={() => void acceptReturn()}>Accept and return</button>
        <button type="button" className="places-btn" onClick={refuseReturn}>Refuse</button>
      </div>
    </>}
    {here.acceptance && <p className="places-line" role="status" data-tone={here.acceptance.accepted ? 'saved' : 'refused'}>{here.acceptance.line}</p>}
  </>
}

/** The sections a palace's plate holds, open or folded to their strips (manual §10.4 "A device can also fold down to its title"): the
 * mockup's three stand open (Rooms, Path, Portals — world-shell-mockup.html:1461); the whole, the composition and the Return fold until
 * pressed, so the plate keeps the mockup's density with every control still one press away. */
export const OPEN_FIRST: Readonly<Record<string, boolean>> = {rooms: true, path: true, portals: true, 'out:palaces': true}

/** The M5′ Palace / Integral Whole plate. `held` are the devices the families declare this instrument holds: each stands in a section. */
export function PalacePlate({held, focused, initialOpen = OPEN_FIRST}: {held: readonly (SectionDevice & {face: string})[]; focused: boolean; initialOpen?: Readonly<Record<string, boolean>>}) {
  const handle = useAtlasLive()
  const {rows} = usePalaces()
  const state = usePalace()
  const here = inside()
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>(initialOpen)
  useEffect(() => { readPalaces() }, [])
  // outside a palace its sections are other sections (the world's palaces open, the palace's own folded until one is entered)
  const fold = (section: Omit<PlateSection, 'folded' | 'onFold'>, key = section.id): PlateSection =>
    ({...section, folded: !open[key], onFold: () => setOpen(current => ({...current, [key]: !current[key]}))})
  const outsideNote = (what: string) => <SectionNote>Enter a palace: {what}</SectionNote>
  const presentation: FacePresentation = {family: 'techne', faceId: 'techne:m5', title: 'Palace / Integral Whole', icon: 'palace',
    owner: ['M5′', 'Technē', here ? `${here.palace.title} r${here.doc.revision}` : 'the palaces of your world', focused ? 'open on the focused pane' : 'opened here', here ? 'scale palace' : null].filter(Boolean).join(' · ')}
  const sections: PlateSection[] = here ? [
    fold({id: 'rooms', title: 'Rooms', width: 300, note: `${roomsNow(here).length} along the path`, children: <RoomsSection here={here} />}),
    fold({id: 'path', title: 'Path', width: 230, note: here.walking ? 'walking' : undefined, children: <PathSection here={here} />}),
    fold({id: 'portals', title: 'Portals', width: 200, children: <PortalsSection here={here} handle={handle} />}),
    fold({id: 'whole', title: 'Integral whole', width: 280, note: here.reading === undefined ? 'reading' : here.reading ? undefined : 'refused', children: <WholeSection here={here} />}),
    fold({id: 'compose', title: 'Compose', width: 260, note: here.busy ? 'saving' : here.regions.length || here.removed.length ? `${here.regions.length} regions` : undefined, children: <ComposeSection here={here} />}),
    fold({id: 'return', title: 'Return', width: 240, note: here.proposal ? 'proposed' : undefined, children: <ReturnSection here={here} />}),
  ] : [
    fold({id: 'palaces', title: 'Palaces', width: 320, note: state.phase === 'entering' ? 'entering' : `${rows.length}`, children: <PalacesSection handle={handle} rows={rows} />}, 'out:palaces'),
    fold({id: 'rooms', title: 'Rooms', width: 180, children: outsideNote('its rooms stand here, along its path.')}, 'out:rooms'),
    fold({id: 'path', title: 'Path', width: 180, children: outsideNote('its walk, its guide and its bookmarks stand here; the transport walks it.')}, 'out:path'),
    fold({id: 'portals', title: 'Portals', width: 180, children: outsideNote('its doors out — to other palaces and to places — stand here.')}, 'out:portals'),
  ]
  if (held.length) sections.push({id: 'held', title: 'Also held', children: <SectionDevices label="Also held" devices={held} />})
  // the palace's one status line (palaceInstrument.tsx:622 message) stands under the sections, in the owner's words
  const footer = here?.line ? <p className="places-line palace-plate-line" role="status">{here.line}</p> : null
  return <InstrumentPlate presentation={presentation} sections={sections} footer={footer}
    dataAttributes={{'data-instrument': 'techne:m5', 'data-expanded': 'true', 'data-palace-plate': 'true', 'data-palace': here ? here.palace.key : undefined, 'data-palace-phase': state.phase}} />
}
