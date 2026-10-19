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
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {shellWriteArm} from './useFactoryTracks'
import {listFiles} from '../../../../../../desktop/cradle/src/files/client'
import {nowReading, type NowListing} from '../../../../../../desktop/cradle/src/receiving/now'
import {launchPage, stopPage} from '../../../../../../desktop/cradle/src/personal/pageOwner'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {readWorlds, readWorldPages, type CentralWorld, type CentralWorldsReading, type WorldPagesReading} from '../../central/centralWorlds'
import {daySetOf, withWorld, writeDaySet} from '../../central/daySet'
import {currentDayOf} from '../../central/devices/dayBinding'
import {openLaunched} from '../../central/launchOpening'
import {documentLayoutWriter} from '../../central/documents/documentDoor'
import {subscribeSystem, systemBodies} from '../../projections/atlas/system/systemStore'
import {worldColourOf} from '../../projections/atlas/system/systemModel'
import {practiceWorldOf} from '../../../../../../desktop/cradle/src/nara/practiceWorld'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useCentralGroundAnswer} from '../../central/devices/useCentralReadings'
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

export function useCentralTracks(reading: TracksReading): WorldTrackSet {
  const shell = useAgentShellOptional()
  const armOn = shell ? shell.writeArm : null
  const transport = reading.transport
  const source = reading.world?.source
  const readAt = source?.readAtUnixMs ?? null
  const ground = useCentralGroundAnswer(transport ?? {kind: 'unavailable', reason: 'the shell published no kernel carrier to this pane'})
  const set = useMemo(() => setReadingOf(ground.reading, ground.error), [ground.reading, ground.error])
  // An act moved what these read: the worlds' pages and what plays are read again.
  const [moved, setMoved] = useState(0)
  const [worlds, setWorlds] = useState<CentralWorldsReading>({state: 'reading'})
  useEffect(() => {
    let live = true
    void readWorlds(transport).then(next => { if (live) setWorlds(next) })
    return () => { live = false }
  }, [transport])
  const inSet = useMemo((): CentralWorld[] => {
    if (worlds.state !== 'read') return []
    const held = set.state === 'read' ? set.set.tracks.map(track => track.world) : []
    return worlds.worlds.filter(world => world.kind === 'yours' || held.includes(world.ref))
  }, [worlds, set])
  const inSetKey = inSet.map(world => `${world.ref}@${world.folder}`).join('|')
  const [pages, setPages] = useState<ReadonlyMap<string, WorldPagesReading>>(new Map())
  const [playing, setPlaying] = useState<readonly CentralPlaying[]>([])
  useEffect(() => {
    let live = true
    for (const world of inSet) void readWorldPages(transport, world).then(next => { if (live) setPages(held => new Map(held).set(world.ref, next)) })
    if (transport && transport.kind !== 'unavailable') {
      const scopes = [null, ...inSet.flatMap(world => world.project ? [world.project] : [])]
      void Promise.all(scopes.map(project => nowReading(transport, project, {kind: 'list'})
        .then(listing => ({project, listing: listing as NowListing})).catch(() => null)))
        .then(listings => { if (live) setPlaying(playingOf(listings.filter((item): item is {project: string | null; listing: NowListing} => item !== null))) })
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the worlds in the set are named by their key
  }, [transport, inSetKey, readAt, moved])
  const aperture = ground.reading ? currentDayOf(ground.reading).aperture : null
  const refreshGround = ground.refresh
  // A launched page opens where its launch says (central/launchOpening.ts), in the pane tree the shell holds. The grid is drawn in a
  // pane root of its own, outside the shell's book (r15: "no pane tree is mounted to open it in"), so the book's writer the shell
  // registers for its panes is the way in when no book is held here.
  const book = useOptionalContinuity()
  const heldBook = useRef(book)
  heldBook.current = book
  const after = useCallback(async <T,>(act: () => Promise<T>): Promise<T> => {
    try { return await act() } finally { setMoved(n => n + 1) }
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
      ...(aperture ? {addWorld: (world: CentralWorld) => after(() => writeDaySet(transport, aperture, held => withWorld(held, world.ref, world.name)).finally(refreshGround))} : {}),
      writeArm: shellWriteArm(armOn),
    }
  }, [transport, armOn, aperture?.sourceRef, aperture?.documentId, after, refreshGround]) // eslint-disable-line react-hooks/exhaustive-deps
  const civil = useMemo(() => civilReadingOf(source), [source])
  // Each world wears its body's colour (manual §17.2 "Your system"); the practice world stands as Practice (T-WORLDS §6 W4).
  const bodies = useSyncExternalStore(subscribeSystem, systemBodies, systemBodies)
  const colours = useMemo(() => new Map(inSet.map(world => [world.ref, worldColourOf(bodies, world.ref).core])), [inSet, bodies])
  // Only a register of its own is a practice track: when your world keeps the practice pages, your world stays your world.
  const practice = useMemo(() => {
    const found = worlds.state === 'read' ? practiceWorldOf(worlds.worlds) : null
    return found?.register === 'practice' ? found.world.ref : null
  }, [worlds])
  return useMemo(() => projectCentralTracks({civil, worlds, set, pages, playing, controls, colours, practice}), [civil, worlds, set, pages, playing, controls, colours, practice])
}
