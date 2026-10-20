// The readings your system stands on (T-WORLDS §5 W3 phase B; T-PROCEDURAL-BODY §6; manual §17.2 "Your system"), held by the pane that holds
// the Earth and published for the globe's overlay, the World device and the browser (system/systemStore.ts). It renders nothing. It reads,
// through the owners and the W2 readings themselves, never a copy of them:
//   - the worlds Central discloses (central/centralWorlds.ts readWorlds, the kernel's world browse) and today's set (the Day's
//     `meta.set`, frame/tracks/useCentralTracks.ts setReadingOf over the shared ground reading, useCentralGroundAnswer);
//   - each project world's body through the kernel's `world_body_read` with its project (body/worldBody.ts kernelWorldBodyOwner), and your
//     world's from the body store the Earth already binds (body/worldBody.ts, the root register), so it is read once;
//   - each world's ground, Central's `central` inspect (central/client.ts readGround): your world's is the one the window already holds
//     (useCentralGroundAnswer), a project's is read for its project and held once like it (owners/ownerReading.ts). Its change horizon is
//     what the agents made (system/artifacts.ts) and, with the world's pages and its body's revision, how lived in the world is
//     (system/worldFacts.ts);
//   - the agent sessions at work (agent/AgentSessionsProvider.tsx), each in the world its SessionSpace belongs to (system/sessionWorld.ts);
//   - the instant the System is drawn for (system/systemClock.ts), which moves once a minute.
// The acts it binds go to their owners: an agent is chosen in the sessions provider, a file an agent made opens as the browser opens a
// file (central/documents/useOpenCentralDocument.ts), and a landing is one BodySet on the landed world's register, on the revision read,
// with the owner's receipt.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {useWorkspace} from '../../../shell/workspaceContext'
import {useAgentSessionsOptional} from '../../../agent/AgentSessionsProvider'
import {GROUND_OP, useCentralGroundAnswer} from '../../../central/devices/useCentralReadings'
import {readWorlds, type CentralWorld, type CentralWorldsReading} from '../../../central/centralWorlds'
import {setReadingOf} from '../../../frame/tracks/useCentralTracks'
import {useCentralDocumentOpener} from '../../../central/documents/useOpenCentralDocument'
import {useSpineEpoch} from '../../../owners/spine'
import {useOwnerReadingsOf, type OwnerRead} from '../../../owners/ownerReading'
import {readGround, sourceLocation, type CentralGroundReading} from '../../../../../../../desktop/cradle/src/central/client'
import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {baseBody, kernelWorldBodyOwner, subscribeWorldBody, worldBodyState, type WorldBodyOwner, type WorldBodyState} from '../body/worldBody'
import {isWorldBody, parseWorldBody, type WorldBodyRecord} from '../src/globe/body'
import {systemOf, systemWorlds, type SystemBody, type SystemBodyReading, type SystemSatellite} from './systemModel'
import {artifactsOf} from './artifacts'
import {openSatellite} from './openSatellite'
import {sessionsOf} from './sessionWorld'
import {subscribeSystemNow, systemNow} from './systemClock'
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

/** A project's ground held once for the window, keyed as the root's is (central/devices/useCentralReadings.ts groundKey) with its project, so
 * a window return reads it again as it reads the root's (the key's op is what that reader looks for). */
const projectGroundKey = (transport: KernelTransportStatus, project: string): string => JSON.stringify([GROUND_OP, transport, project])
const readProjectGround = (transport: KernelTransportStatus, project: string): OwnerRead<CentralGroundReading> => async () => ({value: await readGround(transport, project)})

/** A ground's change horizon, once the owner has answered it: the horizon the agents' artefacts and the register's age are read from. */
const horizonOf = (ground: CentralGroundReading | null | undefined): unknown => (ground?.sources.state === 'ready' ? ground.sources.data : null)

export function SystemReadings(): null {
  const workspace = useWorkspace()
  const {transport} = workspace
  const epoch = useSpineEpoch()
  const ground = useCentralGroundAnswer(transport)
  const set = useMemo(() => setReadingOf(ground.reading, ground.error), [ground.reading, ground.error])
  const sessions = useAgentSessionsOptional()
  const opener = useCentralDocumentOpener()
  const yours = useSyncExternalStore(subscribeWorldBody, worldBodyState, worldBodyState)
  const nowMs = useSyncExternalStore(subscribeSystemNow, systemNow, systemNow)
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
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let live = true
    for (const world of inSet) {
      if (!world.project) continue
      void readBodyOf(kernelWorldBodyOwner(transport, world.project)).then(next => { if (live) setBodies(known => new Map(known).set(world.ref, next)) })
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the worlds of the set are named by their key
  }, [transport, inSetKey, epoch, moved])
  // each project world's ground, one reader of many held once for the window; none while no carrier stands
  const projects = useMemo(() => (transport.kind === 'unavailable' ? [] : inSet.flatMap(world => (world.project ? [world.project] : []))), [transport, inSetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const projectGrounds = useOwnerReadingsOf(projects, project => projectGroundKey(transport, project), project => readProjectGround(transport, project), epoch)
  const sessionRows = useMemo(() => sessionsOf(sessions?.tracks ?? [], sessions?.rows ?? [], inSet), [sessions?.tracks, sessions?.rows, inSet])
  const allBodies = useMemo(() => {
    const merged = new Map(bodies)
    const own = inSet.find(world => world.kind === 'yours')
    if (own) merged.set(own.ref, yourBodyReading(yours))
    return merged
  }, [bodies, inSet, yours])
  // what each world's agents have made, from each register's change horizon
  const artifacts = useMemo(() => inSet.flatMap(world =>
    artifactsOf(horizonOf(world.project ? projectGrounds.get(world.project) : ground.reading), world.project)), [inSet, projectGrounds, ground.reading])
  const system = useMemo(() => systemOf({worlds: inSet, bodies: allBodies, sessions: sessionRows, artifacts, nowMs}), [inSet, allBodies, sessionRows, artifacts, nowMs])

  useEffect(() => {
    if (transport.kind === 'unavailable') { publishSystem({state: 'unavailable', reason: transport.reason}); return }
    if (worlds.state === 'reading') { publishSystem({state: 'reading'}); return }
    if (worlds.state === 'unavailable') { publishSystem({state: 'unavailable', reason: worlds.reason}); return }
    publishSystem({state: 'read', bodies: system, set: set.state === 'read' ? null : set.state === 'none' ? `today’s set holds only your world: ${set.reason}` : 'today’s set is being read'})
  }, [transport, worlds, system, set])

  const selectSession = sessions?.selectSession
  useEffect(() => {
    bindSystemActs({
      open: (satellite: SystemSatellite, body: SystemBody) => openSatellite(satellite, body, {
        ...(selectSession ? {selectSession} : {}),
        // a file an agent made opens as the browser opens a file: its source ref's location, read through Central, then the file route
        openArtifact: async (artifact, world) => {
          if (transport.kind === 'unavailable') throw Error(transport.reason)
          const location = await sourceLocation(transport, world.world.project, artifact.id)
          await opener.openFile({name: artifact.name, kind: 'file', retrieval_allowed: true, location}, location.path)
        },
      }),
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
  }, [transport, system, allBodies, opener, selectSession])
  useEffect(() => () => bindSystemActs(null), [])
  return null
}
