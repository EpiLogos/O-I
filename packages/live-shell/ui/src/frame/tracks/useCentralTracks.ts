// Central's tracks for the shared Session and Arrangement (manual §18.1; T-WORLDS §4 W2): the mode's hook over the readings its
// owners give, never copied into a second store:
// - the worlds: Central's disclosure of its registers (central/centralWorlds.ts readWorlds, the kernel's world browse);
// - today's set: the Day document as Central's ground reads it (useCentralGroundAnswer → dayBinding.ts currentDayOf), its
//   `meta.set` (central/daySet.ts daySetOf). A Day not opened yet, or whose document is not made, keeps no set and says so;
// - each world's pages in today's set: the page owner's listing of its folder (readWorldPages);
// - what plays: the NOW clearings of your world and of each project world in the set whose task is a page's
//   (kernel/src/page.rs `page_task`), active;
// - the day's entries: the World cut's one temporal read, which the frame already publishes as `reading.world`.
// The acts: Launch and Stop are the page owner's (pageOwner.ts launchPage, stopPage); a world dropped on the empty track is written
// into the Day's set (writeDaySet); every world's Arm is the shell's one write arm. After an act the readings it moved are read
// again. Registered as `base: worldCut(useCentralTracks)` in modeTracks.ts.
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {shellWriteArm} from './useFactoryTracks'
import {listFiles} from '../../../../../../desktop/cradle/src/files/client'
import {nowReading, type NowListing} from '../../../../../../desktop/cradle/src/receiving/now'
import {launchPage, stopPage} from '../../../../../../desktop/cradle/src/personal/pageOwner'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {readWorlds, readWorldPages, type CentralWorld, type CentralWorldsReading } from '../../central/centralWorlds'
import {daySetOf, withWorld, withoutWorld, writeDaySet} from '../../central/daySet'
import {currentDayOf} from '../../central/devices/dayBinding'
import {openLaunched} from '../../central/launchOpening'
import {documentLayoutWriter} from '../../central/documents/documentDoor'
import {subscribeSystem, systemReading} from '../../projections/atlas/system/systemStore'
import {worldColourOf} from '../../projections/atlas/system/systemModel'
import {practiceWorldOf} from '../../../../../../desktop/cradle/src/nara/practiceWorld'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useHeldRead, useStableMap} from '../../owners/ownerCall'
import {useOwnerReadingsOf} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import {useSeatStatusAnswer} from '../../agent/devices/workcellReads'
import {withWorksIn} from './returnTracks'
import {nameTrackHeadDevices, type TrackHeadDevice} from './trackHeads'
import {openInstrument} from '../instrumentDoor'
import {DEVICE_PANE_KIND} from '../devices/devicePane'
import {centralDeviceId} from '../../central/devices/centralDeviceModel'
import {openOrRevealInCentral} from '../../central/devices/centralOpenReveal'
import {centralWorldTrackId} from '../../timeline/centralTrackAdapter'
import {useCentralGroundAnswer, usePageHistories} from '../../central/devices/useCentralReadings'
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {
  CENTRAL_DAY_RECORDS_PATH,
  civilReadingOf,
  dayRecordsOf,
  projectCentralTracks,
  type CentralDayRecordsReading,
  type CentralPlaying,
  type CentralSetReading,
} from '../../timeline/centralTrackAdapter'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksReading} from './modeTracks'

/** The day records through the owner's listing route (the browser's Days rows read the same). A refusal is the reading, named. */
export async function readDayRecords(transport: KernelTransportStatus | undefined): Promise<CentralDayRecordsReading> {
  if (!transport) return {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'}
  if (transport.kind === 'unavailable') return {state: 'unavailable', reason: transport.reason}
  try {
    return {state: 'read', records: dayRecordsOf(await listFiles(transport, CENTRAL_DAY_RECORDS_PATH))}
  } catch (cause) {
    return {state: 'unavailable', reason: cause instanceof Error ? cause.message : String(cause)}
  }
}

/** Today's set as the ground reads the Day: its document's `meta.set`, or why there is none. Pure. */
export function setReadingOf(ground: CentralGroundReading | null, error: string | null): CentralSetReading {
  if (!ground) return error ? {state: 'none', reason: error} : {state: 'reading'}
  const {standing} = currentDayOf(ground)
  if (!standing) return {state: 'reading'}
  if (standing.state === 'uninitialised') return {state: 'none', reason: `today's Day has no document yet: open today (${standing.op})`}
  if (standing.state === 'refused') return {state: 'none', reason: standing.message}
  const reading = ground.day.data!
  const basis = validateDocumentBasis(reading.document, standing.sourceRef, standing.documentId)
  return {state: 'read', set: daySetOf(basis.payload), civilDate: standing.civilDate}
}

// The pages that play now (each active clearing whose task is a page's) are read by the pure adapter, which the Day's close reads too.
import {playingOf} from '../../timeline/centralTrackAdapter'
export {playingOf}

/** The world's Docs on the door (central/devices/CentralDevices.tsx publishes it on the world's chain, DLW §16.2, §18.5). */
const DOCS_DEVICE = centralDeviceId('docs')

export function useCentralTracks(reading: TracksReading): WorldTrackSet {
  const shell = useAgentShellOptional()
  const armOn = shell ? shell.writeArm : null
  const transport = reading.transport
  const source = reading.world?.source
  const ground = useCentralGroundAnswer(transport ?? {kind: 'unavailable', reason: 'the shell published no kernel carrier to this pane'})
  const set = useMemo(() => setReadingOf(ground.reading, ground.error), [ground.reading, ground.error])
  // The worlds, each world's pages and what plays are held readings (owners/ownerCall.ts, owners/ownerReading.ts): read once for the
  // window, shared with every other view that reads them, and read again when the kernel says the ground moved — an act of this
  // window's (a launch, a stop, a Day write) is such a notice on its receipt, so no act has to ask for them again.
  const epoch = useSpineEpoch()
  const usable = transport && transport.kind !== 'unavailable' ? transport : null
  const worldsReading = useHeldRead(['worlds', transport ?? null], () => readWorlds(transport))
  const worlds = useMemo((): CentralWorldsReading => worldsReading.status === 'answered' && worldsReading.value ? worldsReading.value : {state: 'reading'}, [worldsReading])
  const inSet = useMemo((): CentralWorld[] => {
    if (worlds.state !== 'read') return []
    const held = set.state === 'read' ? set.set.tracks.map(track => track.world) : []
    return worlds.worlds.filter(world => world.kind === 'yours' || held.includes(world.ref))
  }, [worlds, set])
  // Each world's head opens the world's Docs full in a pane (§18.1: "The settings stand on the track's head … The world's account of itself
  // is Docs, on the track's chain (§18.5)"; the Workspace device that the head opened before was retired in the 22 Oct manual rewrite, its
  // Ground and Self pages folded into Docs). The press selects the track first, so the device reads that world.
  useEffect(() => {
    const devices = new Map<string, TrackHeadDevice>(inSet.map(world => [centralWorldTrackId(world.ref), {
      title: 'Docs',
      does: `Open ${world.name}'s Docs full in a pane: the world's account of itself, on six tiers`,
      open: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: DOCS_DEVICE, title: `${world.name} · Docs`}),
    }]))
    nameTrackHeadDevices('central', devices)
    return () => nameTrackHeadDevices('central', null)
  }, [inSet])
  const folders = useMemo(() => usable ? inSet.map(world => world.folder) : [], [usable, inSet])
  const pageAnswers = useOwnerReadingsOf(folders, folder => JSON.stringify(['world-pages', usable, folder]),
    folder => async () => ({value: await readWorldPages(usable ?? undefined, {folder})}), epoch)
  const pages = useStableMap(new Map(inSet.flatMap(world => pageAnswers.has(world.folder) ? [[world.ref, pageAnswers.get(world.folder)!] as const] : [])))
  const scopes = useMemo(() => usable ? ['', ...inSet.flatMap(world => world.project ? [world.project] : [])] : [], [usable, inSet])
  const nowAnswers = useOwnerReadingsOf(scopes, scope => JSON.stringify(['world-now', usable, scope]),
    scope => async () => ({value: {project: scope || null, listing: await nowReading(usable!, scope || null, {kind: 'list'}) as NowListing}}), epoch)
  const nowListings = useStableMap(nowAnswers)
  const playing = useMemo((): readonly CentralPlaying[] => playingOf([...nowListings.values()]), [nowListings])
  const aperture = ground.reading ? currentDayOf(ground.reading).aperture : null
  const refreshGround = ground.refresh
  // A launched page opens where its launch says (central/launchOpening.ts), in the pane tree the shell holds. The grid is drawn in a
  // pane root of its own, outside the shell's book (r15: "no pane tree is mounted to open it in"), so the book's writer the shell
  // registers for its panes is the way in when no book is held here.
  const book = useOptionalContinuity()
  const heldBook = useRef(book)
  heldBook.current = book
  const after = useCallback(async <T,>(act: () => Promise<T>): Promise<T> => {
    return act()
  }, [])
  const controls = useMemo(() => {
    if (!transport || transport.kind === 'unavailable') return {writeArm: shellWriteArm(armOn)}
    return {
      launch: (page: {location: Parameters<typeof launchPage>[1]; form?: string}) => after(async () => {
        await launchPage(transport, page.location)
        const write = heldBook.current ? (update: Parameters<NonNullable<typeof heldBook.current>['setLayout']>[0]) => heldBook.current?.setLayout(update) : documentLayoutWriter()
        return openLaunched(transport, write, page)
      }),
      stop: (item: CentralPlaying) => after(() => stopPage(transport, item.nowRef, item.project)),
      ...(aperture ? {
        addWorld: (world: CentralWorld) => after(() => writeDaySet(transport, aperture, held => withWorld(held, world.ref, world.name)).finally(refreshGround)),
        removeWorld: (world: CentralWorld) => after(() => writeDaySet(transport, aperture, held => withoutWorld(held, world.ref)).finally(refreshGround)),
      } : {}),
      writeArm: shellWriteArm(armOn),
      openOrReveal: (act: 'open' | 'reveal', path: string) => openOrRevealInCentral(transport, act, path),
    }
  }, [transport, armOn, aperture?.sourceRef, aperture?.documentId, after, refreshGround]) // eslint-disable-line react-hooks/exhaustive-deps
  const civil = useMemo(() => civilReadingOf(source), [source])
  // Each world wears its body's colour (manual §17.2 "Your system"); the practice world stands as Practice (T-WORLDS §6 W4).
  // The store's reading is one value until the system changes; the bodies are taken from it (a derived list per read would make
  // React see a new snapshot on every render and drop the grid, r16).
  const system = useSyncExternalStore(subscribeSystem, systemReading, systemReading)
  const bodies = system.state === 'read' ? system.bodies : null
  const colours = useMemo(() => new Map(inSet.map(world => [world.ref, worldColourOf(bodies ?? [], world.ref).core])), [inSet, bodies])
  // Only a register of its own is a practice track: when your world keeps the practice pages, your world stays your world.
  const practice = useMemo(() => {
    const found = worlds.state === 'read' ? practiceWorldOf(worlds.worlds) : null
    return found?.register === 'practice' ? found.world.ref : null
  }, [worlds])
  // Each world's agent works in the workcell holding its project's seat (§19.23 Works in, §16.6 In/Out); your own world holds no seat.
  const seats = useSeatStatusAnswer(usable ?? {kind: 'unavailable', reason: 'no carrier'}, !!usable).reading
  const register = seats.status === 'answered' ? seats.value : null
  const projectOf = useMemo(() => {
    const byTrack = new Map(inSet.map(world => [centralWorldTrackId(world.ref), world.project]))
    return (track: {id: string}) => byTrack.get(track.id) ?? null
  }, [inSet])
  // A page's revisions are its takes (manual §18.1): each page's source history, read once per page and again on the spine's epoch. The
  // standing take runs to now as of the last time the set was drawn (now is read inside the memo, never a dependency of it).
  const histories = usePageHistories(transport, inSet, pages, epoch)
  return useMemo(() => withWorksIn(projectCentralTracks({civil, worlds, set, pages, playing, controls, colours, practice, histories, nowMs: Date.now()}), register, projectOf,
    seats.status === 'refused' ? seats.error : null), [civil, worlds, set, pages, playing, controls, colours, practice, histories, register, projectOf, seats])
}
