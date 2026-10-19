// The readings your system stands on (T-WORLDS §5 W3 phase B; manual §17.2 "Your system"), held by the pane that holds the Earth and
// published for the globe's overlay, the World device and the browser (system/systemStore.ts). It renders nothing. It reads, through the
// owners and the W2 readings themselves, never a copy of them:
//   - the worlds Central discloses (central/centralWorlds.ts readWorlds, the kernel's world browse) and today's set (the Day's
//     `meta.set`, frame/tracks/useCentralTracks.ts setReadingOf over the shared ground reading, useCentralGroundAnswer);
//   - each project world's body through the kernel's `world_body_read` with its project (body/worldBody.ts kernelWorldBodyOwner), and your
//     world's from the body store the Earth already binds (body/worldBody.ts, the root register), so it is read once;
//   - the pages that play: the NOW listing of your register and of each project world in the set, as playingOf reads it (the pages'
//     titles from the page owner's listing of each world's folder, readWorldPages);
//   - the agent sessions at work (agent/AgentSessionsProvider.tsx) and the files and context to hand (the workspace's open source and
//     its works, shell/workspaceTypes.ts).
// The acts it binds go to their owners: a page opens as the browser opens it (central/documents/useOpenCentralDocument.ts), a session
// is chosen in the sessions provider, a work is requested through the workspace's one open door, and a landing is one BodySet on the
// landed world's register, on the revision read, with the owner's receipt.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {useWorkspace} from '../../../shell/workspaceContext'
import {useAgentSessionsOptional} from '../../../agent/AgentSessionsProvider'
import {useCentralGroundAnswer} from '../../../central/devices/useCentralReadings'
import {readWorlds, readWorldPages, type CentralWorld, type CentralWorldsReading} from '../../../central/centralWorlds'
import {setReadingOf} from '../../../frame/tracks/useCentralTracks'
import {playingOf} from '../../../timeline/centralTrackAdapter'
import {useCentralDocumentOpener} from '../../../central/documents/useOpenCentralDocument'
import {useSpineEpoch} from '../../../owners/spine'
import {nowReading, type NowListing} from '../../../../../../../desktop/cradle/src/receiving/now'
import type {CentralPlaying} from '../../../timeline/centralTrackAdapter'
import type {CentralLocation} from '../../../../../../../desktop/cradle/src/kernel/location'
import type {PageForm} from '../../../../../../../desktop/cradle/src/personal/pageOwner'
import {baseBody, kernelWorldBodyOwner, subscribeWorldBody, worldBodyState, type WorldBodyOwner, type WorldBodyState} from '../body/worldBody'
import {isWorldBody, parseWorldBody, type WorldBodyRecord} from '../src/globe/body'
import {systemOf, systemWorlds, type SystemBody, type SystemBodyReading, type SystemSatellite} from './systemModel'
import {bindSystemActs, publishSystem} from './systemStore'

/** Your world's body as the body store reads it, in the System's terms. */
export function yourBodyReading(state: WorldBodyState): SystemBodyReading {
  if (state.state === 'read') return {state: 'read', reading: state.reading, record: state.record}
  if (state.state === 'refused') return {state: 'refused', reason: state.reason}
  return {state: 'reading'}
}

/** A world's body through its owner, in the System's terms. A malformed record is the owner's to repair: it is named. */
export async function readBodyOf(owner: Pick<WorldBodyOwner, 'read'>): Promise<SystemBodyReading> {
  try {
    const reading = await owner.read()
    if (reading.body === null || reading.body === undefined) return {state: 'read', reading, record: null}
    const parsed = parseWorldBody(reading.body)
    return isWorldBody(parsed) ? {state: 'read', reading, record: parsed} : {state: 'refused', reason: `The owner’s world body cannot be drawn: ${parsed.refused}.`}
  } catch (error) {
    return {state: 'refused', reason: error instanceof Error ? error.message : String(error)}
  }
}

/** Two landings are one when they name the same body at the same point. By value: the owner keeps a record's keys in its own order
 * (AIKit sorts them), so a landing read back is never the same string as the one sent (r21). */
function sameLanding(a: WorldBodyRecord['landing'] | null | undefined, b: WorldBodyRecord['landing'] | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.on_ref === b.on_ref && a.lat === b.lat && a.lon === b.lon
}

/** Land a world on your planet: its body as it reads (or the body seeded from its ref, the one its first change builds on) with the
 * landing, written whole as one BodySet on its register at the revision read; the owner's refusal is thrown in its words. */
export async function landWorld(owner: WorldBodyOwner, body: SystemBody, yours: SystemBody | undefined, reading: SystemBodyReading | undefined, lat: number, lon: number): Promise<string> {
  if (body.yours) throw Error('Your own world is the planet the others land on; it does not land on itself.')
  if (!yours || yours.state === 'reading' || yours.state === 'refused') throw Error(`Your planet’s body is not read, so nothing can land on it yet${yours?.state === 'refused' ? `: ${yours.standing}` : ''}.`)
  if (!reading || reading.state !== 'read') throw Error(`${body.world.name}’s body is not read, so its landing cannot be written: ${body.standing}.`)
  if (!body.world.project) throw Error(`${body.world.name} is not a project’s world, so no register of its own keeps its body.`)
  const base = baseBody({state: 'read', reading: reading.reading, record: reading.record})
  const next = {...base, landing: {on_ref: yours.bodyRef, lat, lon}}
  const parsed = parseWorldBody(next)
  if (!isWorldBody(parsed)) throw Error(`The landing is refused before it is sent: ${parsed.refused}.`)
  await owner.write(parsed, {space_ref: reading.reading.space.ref, revision: reading.reading.space.revision})
  const after = await readBodyOf(owner)
  if (after.state !== 'read' || !sameLanding(after.record?.landing, parsed.landing)) {
    throw Error('The owner confirmed the save, but the landing did not read back as written. Read before retrying.')
  }
  return `${body.world.name} lands on your planet at ${lat.toFixed(2)}, ${lon.toFixed(2)}: its body is saved at revision ${after.reading.space.revision}.`
}

/** Take a world off your planet: its body as it reads, written whole without the landing as one BodySet on its register at the revision
 * read, and read back to show none. Every setting and the seed stay; only where it lands goes. The owner's refusal is thrown in its words. */
export async function unlandWorld(owner: WorldBodyOwner, body: SystemBody, reading: SystemBodyReading | undefined): Promise<string> {
  if (body.yours) throw Error('Your own world is the planet the others land on; it lands nowhere, so there is nothing to take off.')
  if (!reading || reading.state !== 'read') throw Error(`${body.world.name}’s body is not read, so its landing cannot be taken off: ${body.standing}.`)
  if (!reading.record?.landing) return `${body.world.name} does not land on your planet; nothing was written.`
  const {landing: _landing, ...kept} = baseBody({state: 'read', reading: reading.reading, record: reading.record}) as WorldBodyRecord & {landing?: unknown}
  const parsed = parseWorldBody(kept)
  if (!isWorldBody(parsed)) throw Error(`Taking the landing off is refused before it is sent: ${parsed.refused}.`)
  await owner.write(parsed, {space_ref: reading.reading.space.ref, revision: reading.reading.space.revision})
  const after = await readBodyOf(owner)
  if (after.state !== 'read' || after.record?.landing) throw Error('The owner confirmed the save, but the body still reads with its landing. Read before retrying.')
  return `${body.world.name} is off your planet: its body is kept, without a landing, at revision ${after.reading.space.revision}.`
}

type Listing = {project: string | null; listing: NowListing}
/** A page of a world's folder as its owner lists it: what a playing page is named by, and where it opens from. */
type ListedPage = {readonly title: string; readonly location: CentralLocation; readonly form: PageForm}

export function SystemReadings(): null {
  const workspace = useWorkspace()
  const {transport} = workspace
  const epoch = useSpineEpoch()
  const ground = useCentralGroundAnswer(transport)
  const set = useMemo(() => setReadingOf(ground.reading, ground.error), [ground.reading, ground.error])
  const sessions = useAgentSessionsOptional()
  const opener = useCentralDocumentOpener()
  const yours = useSyncExternalStore(subscribeWorldBody, worldBodyState, worldBodyState)
  const [worlds, setWorlds] = useState<CentralWorldsReading>({state: 'reading'})
  const [moved, setMoved] = useState(0)
  useEffect(() => {
    let live = true
    void readWorlds(transport).then(next => { if (live) setWorlds(next) })
    return () => { live = false }
  }, [transport, epoch])
  const inSet = useMemo((): CentralWorld[] => worlds.state === 'read'
    ? systemWorlds(worlds.worlds, set.state === 'read' ? set.set.tracks.map(track => track.world) : [])
    : [], [worlds, set])
  const inSetKey = inSet.map(world => `${world.ref}@${world.project ?? ''}@${world.folder}`).join('|')
  const [bodies, setBodies] = useState<ReadonlyMap<string, SystemBodyReading>>(new Map())
  const [listings, setListings] = useState<readonly Listing[]>([])
  const [pages, setPages] = useState<ReadonlyMap<string, ListedPage>>(new Map())
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let live = true
    for (const world of inSet) {
      if (!world.project) continue
      const project = world.project
      void readBodyOf(kernelWorldBodyOwner(transport, project)).then(next => { if (live) setBodies(held => new Map(held).set(world.ref, next)) })
    }
    const scopes = [null, ...inSet.flatMap(world => world.project ? [world.project] : [])]
    void Promise.all(scopes.map(project => nowReading(transport, project, {kind: 'list'})
      .then(listing => ({project, listing: listing as NowListing})).catch(() => null)))
      .then(read => { if (live) setListings(read.filter((item): item is Listing => item !== null)) })
    for (const world of inSet) {
      void readWorldPages(transport, world).then(next => {
        if (!live || next.state !== 'read') return
        setPages(held => {
          const merged = new Map(held)
          for (const page of next.listing.pages) merged.set(page.location.ref, {title: page.title ?? page.name, location: page.location, form: page.form})
          return merged
        })
      })
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the worlds of the set are named by their key
  }, [transport, inSetKey, epoch, moved])
  const playing = useMemo((): CentralPlaying[] => playingOf(listings), [listings])
  const titles = useMemo(() => new Map([...pages].map(([ref, page]) => [ref, page.title])), [pages])
  const sessionRows = useMemo(() => (sessions?.tracks ?? []).map(track => ({sessionRef: track.sessionRef, agentName: track.agentName, purpose: track.purpose, group: track.group})), [sessions?.tracks])
  const file = workspace.selectedSource
  const hand = useMemo(() => ({
    file: file ? {ref: file.location.ref, path: file.location.path ?? file.location.ref} : null,
    works: workspace.nativeWorks.map(work => ({expression_ref: work.expression_ref, title: work.title})),
  }), [file?.location.ref, file?.location.path, workspace.nativeWorks]) // eslint-disable-line react-hooks/exhaustive-deps
  const allBodies = useMemo(() => {
    const merged = new Map(bodies)
    const own = inSet.find(world => world.kind === 'yours')
    if (own) merged.set(own.ref, yourBodyReading(yours))
    return merged
  }, [bodies, inSet, yours])
  const system = useMemo(() => systemOf({worlds: inSet, bodies: allBodies, playing, titles, sessions: sessionRows, hand}), [inSet, allBodies, playing, titles, sessionRows, hand])

  useEffect(() => {
    if (transport.kind === 'unavailable') { publishSystem({state: 'unavailable', reason: transport.reason}); return }
    if (worlds.state === 'reading') { publishSystem({state: 'reading'}); return }
    if (worlds.state === 'unavailable') { publishSystem({state: 'unavailable', reason: worlds.reason}); return }
    publishSystem({state: 'read', bodies: system, set: set.state === 'read' ? null : set.state === 'none' ? `today’s set holds only your world: ${set.reason}` : 'today’s set is being read'})
  }, [transport, worlds, system, set])

  const selectSession = sessions?.selectSession
  const requestExpression = workspace.requestExpression
  useEffect(() => {
    bindSystemActs({
      open: async (satellite: SystemSatellite) => {
        if (satellite.kind === 'session') { selectSession?.(satellite.id); return }
        if (satellite.kind === 'work') { requestExpression(satellite.id); return }
        if (satellite.kind === 'page') {
          // as the browser's page rows open it: a Being or a Thing in a pane of its own, a Flow (or another page) as its file
          const page = pages.get(satellite.id)
          if (!page) throw Error(`${satellite.name} is not in its world’s page listing, so it does not open from here.`)
          const entry = {name: page.title, kind: 'file' as const, retrieval_allowed: true, location: page.location}
          if (page.form === 'being' || page.form === 'thing') await opener.openPage(entry, page.form)
          else await opener.openFile(entry, page.location.path)
        }
      },
      land: async (body, lat, lon) => {
        if (transport.kind === 'unavailable') throw Error(transport.reason)
        if (!body.world.project) throw Error(`${body.world.name} is not a project’s world, so no register of its own keeps its body.`)
        // read again whatever the answer: a refusal after the owner wrote (a readback that needs reconciling) leaves its record moved (r21)
        try { return await landWorld(kernelWorldBodyOwner(transport, body.world.project), body, system.find(entry => entry.yours), allBodies.get(body.world.ref), lat, lon) }
        finally { setMoved(n => n + 1) }
      },
      unland: async body => {
        if (transport.kind === 'unavailable') throw Error(transport.reason)
        if (!body.world.project) throw Error(`${body.world.name} is not a project’s world, so no register of its own keeps its body.`)
        try { return await unlandWorld(kernelWorldBodyOwner(transport, body.world.project), body, allBodies.get(body.world.ref)) }
        finally { setMoved(n => n + 1) }
      },
    })
  }, [transport, system, allBodies, pages, opener, selectSession, requestExpression])
  useEffect(() => () => bindSystemActs(null), [])
  return null
}
