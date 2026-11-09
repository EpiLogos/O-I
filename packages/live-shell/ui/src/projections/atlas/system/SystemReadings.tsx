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
//   - [O-I #858 SF12, SF13] while the Field is the scale drawn, the Runs of Software Factory's this window's Factory states hold, each
//     under the name Factory shows it by (kernel factory_owner `locate`, each state's `project` reading and each Run's `work-show-read`),
//     and the units of the Run chosen at a star (the `workflow-units` reading), to offer one; and where each task the taker's state took
//     up stands there (its `task-offers-read`), so a revocation the field shows is told to that Factory (atlasDevices.ts relayRevoked);
//     and which world each task a state made was taken up by, so a take the field shows is told to it (atlasDevices.ts relayTaken).
// The acts it binds go to their owners: an agent is chosen in the sessions provider, a file an agent made opens as the browser opens a
// file (central/documents/useOpenCentralDocument.ts), and a landing is one BodySet on the landed world's register, on the revision read,
// with the owner's receipt; an act on work or tasks at a star is asked of Software Factory through the kernel's factory_owner.
import {useEffect, useMemo, useSyncExternalStore} from 'react'
import {useWorkspace} from '../../../shell/workspaceContext'
import {useAgentSessionsOptional} from '../../../agent/AgentSessionsProvider'
import {useAgentShellOptional} from '../../../agent/AgentShellContext'
import {attendedKeys, trackKey} from '../../../agent/agentRunModel'
import {GROUND_OP, useCentralGroundAnswer} from '../../../central/devices/useCentralReadings'
import {readWorlds, readWorldPages, type CentralWorld, type CentralWorldsReading} from '../../../central/centralWorlds'
import {setReadingOf} from '../../../frame/tracks/useCentralTracks'
import {useCentralDocumentOpener} from '../../../central/documents/useOpenCentralDocument'
import {useSpineEpoch} from '../../../owners/spine'
import {useOwnerReading, useOwnerReadingsOf, type OwnerRead} from '../../../owners/ownerReading'
import {opKey, readOp, useHeldRead, useStableMap, type OpOutcome} from '../../../owners/ownerCall'
import {readGround, sourceLocation, type CentralGroundReading} from '../../../../../../../desktop/cradle/src/central/client'
import type {KernelOp, KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {kernelOp, kernelReadSend, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import {baseBody, kernelWorldBodyOwner, subscribeWorldBody, worldBodyState, type WorldBodyOwner, type WorldBodyState} from '../body/worldBody'
import {isWorldBody, parseWorldBody, type WorldBodyRecord} from '../src/globe/body'
import {systemOf, systemWorlds, type SystemBody, type SystemBodyReading, type SystemSatellite} from './systemModel'
import {artifactsOf} from './artifacts'
import {openSatellite} from './openSatellite'
import {sessionsOf} from './sessionWorld'
import {worldFactsOf} from './worldFacts'
import {subscribeSystemNow, systemNow} from './systemClock'
import {bindSystemActs, fieldView, heldField, publishFactory, publishField, publishSystem, runKeyOf, starHand, subscribeSystem, type FactoryRun, type FactoryTaker, type FactoryUnit} from './systemStore'
import {heldFieldOf, liveWork, starNote, withGone, type Aperture} from './fieldModel'

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

// ── Software Factory at a star (O-I #858 SF12, SF13) ─────────────────────────────────────────────────────────────────────

const FACTORY_SILENT = 'Software Factory gave no answer.'
/** At most this many Runs of one Factory state are offered to choose at a star. */
const RUNS_PER_STATE = 32
type Send = (op: KernelOp) => Promise<KernelOpCall>
const recOf = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)
const strOf = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)
/** Factory's document from one kernel answer, or its refusal thrown in its words. */
function factoryData(call: KernelOpCall): unknown {
  if (call.error) throw Error(fieldWords(call.error))
  if (call.outcome?.result !== 'factory_development_reading') throw Error(FACTORY_SILENT)
  return call.outcome.data
}

/** The Runs this window's Factory states hold, each under the name Factory shows it by, and the states a task your world takes up may be
 * kept in (the first located, Central's own when it keeps one, stands until another is chosen on the face). A Run Factory will not show
 * is left out, never named here. */
export async function readFactoryRuns(send: Send): Promise<{runs: FactoryRun[]; takers: FactoryTaker[]; takerState: string | null}> {
  const located = recOf(factoryData(await send({op: 'factory_owner', request: {kind: 'locate', all: true}})))
  const rows = Array.isArray(located?.locations) ? located.locations.map(recOf).filter((row): row is Record<string, unknown> => row !== null) : []
  const states = rows.flatMap(row => {
    const at = recOf(row.location)
    const statePath = strOf(at?.statePath), projectRef = strOf(at?.projectRef)
    return row.state === 'located' && statePath && projectRef ? [{statePath, projectRef, project: strOf(row.project)}] : []
  })
  if (!states.length) throw Error(strOf(rows.find(row => strOf(row.error))?.error) ?? 'Software Factory keeps no state in this window’s ground.')
  const runs: FactoryRun[] = []
  for (const state of states) {
    const project = await send({op: 'factory_development_read', ...(state.project ? {project: state.project} : {}), state_path: state.statePath, read: 'project', subject: state.projectRef})
    if (project.error || project.outcome?.result !== 'factory_development_reading') continue
    const journeys = recOf(project.outcome.data)?.journeys
    const refs = [...new Set((Array.isArray(journeys) ? journeys : []).flatMap(journey => {
      const listed = recOf(journey)?.runRefs ?? recOf(journey)?.run_refs
      return Array.isArray(listed) ? listed.filter((ref): ref is string => typeof ref === 'string') : []
    }))].slice(-RUNS_PER_STATE)
    for (const runRef of refs) {
      const shown = await send({op: 'factory_owner', request: {kind: 'work-show-read', state_path: state.statePath, run_ref: runRef}})
      const doc = !shown.error && shown.outcome?.result === 'factory_development_reading' ? recOf(shown.outcome.data) : null
      if (!doc) continue
      runs.push({key: runKeyOf(state.statePath, runRef), statePath: state.statePath, runRef, name: strOf(doc.name) ?? runRef, standing: strOf(doc.standing) ?? 'live', project: state.project,
        revision: typeof doc.revision === 'number' ? doc.revision : null})
    }
  }
  return {runs, takers: states.map(state => ({statePath: state.statePath, project: state.project})), takerState: states[0].statePath}
}

/** The units of one Run, as an offer names its task (Factory's `workflow-units` reading for the Run). */
export async function readRunUnits(send: Send, run: FactoryRun): Promise<FactoryUnit[]> {
  const data = recOf(factoryData(await send({op: 'factory_development_read', ...(run.project ? {project: run.project} : {}), state_path: run.statePath, read: 'workflow-units', subject: run.runRef})))
  return (Array.isArray(data?.units) ? data.units : []).flatMap(unit => {
    const row = recOf(unit), ref = strOf(row?.workflowUnitRef ?? row?.workflow_unit_ref), key = strOf(row?.key)
    return ref && key ? [{ref, key}] : []
  })
}

/** Where each task the takers' Factory states took up at a star stands there (taken, returned, revoked), by offer ref, the state that
 * holds it, and what it gave back where it gave something; and [SF13.3c] each task the states made, by offer ref, the state that made
 * it and the world it keeps as having taken it up (null while none): each state's `offers` reading. The first state to hold an offer
 * answers for it. */
export async function readTakenOffers(send: Send, statePaths: readonly string[]): Promise<{taken: Record<string, string>; takenAt: Record<string, string>; returns: Record<string, Record<string, unknown>>
  madeAt: Record<string, string>; madeTaker: Record<string, string | null>}> {
  const taken: Record<string, string> = {}, takenAt: Record<string, string> = {}, returns: Record<string, Record<string, unknown>> = {}
  const madeAt: Record<string, string> = {}, madeTaker: Record<string, string | null> = {}
  for (const statePath of statePaths) {
    const data = recOf(factoryData(await send({op: 'factory_owner', request: {kind: 'task-offers-read', state_path: statePath}})))
    for (const row of Array.isArray(data?.taken) ? data.taken : []) {
      const record = recOf(row), ref = strOf(recOf(record?.offer)?.offer_ref), state = strOf(record?.state), back = recOf(record?.return)
      if (!ref || !state || ref in taken) continue
      taken[ref] = state
      takenAt[ref] = statePath
      if (back) returns[ref] = back
    }
    for (const row of Array.isArray(data?.made) ? data.made : []) {
      const record = recOf(row), ref = strOf(recOf(record?.offer)?.offer_ref)
      if (!ref || ref in madeAt) continue
      madeAt[ref] = statePath
      madeTaker[ref] = strOf(recOf(record?.taken)?.world_ref) ?? null
    }
  }
  return {taken, takenAt, returns, madeAt, madeTaker}
}

/** A project's ground held once for the window, keyed as the root's is (central/devices/useCentralReadings.ts groundKey) with its project, so
 * a window return reads it again as it reads the root's (the key's op is what that reader looks for). */
const projectGroundKey = (transport: KernelTransportStatus, project: string): string => JSON.stringify([GROUND_OP, transport, project])
const readProjectGround = (transport: KernelTransportStatus, project: string): OwnerRead<CentralGroundReading> => async () => ({value: await readGround(transport, project)})

/** A ground's change horizon, once the owner has answered it: the horizon the agents' artefacts and the register's age are read from. */
const horizonOf = (ground: CentralGroundReading | null | undefined): unknown => (ground?.sources.state === 'ready' ? ground.sources.data : null)

/** The worlds in the window's held SharedField (kernel `shared_field` op): the Field scale's reading (O-I #858). The worlds, their
 * clearings, the stars and who gathered there are held beside the field's own rows, so reading them alone brings no field's rows into
 * view; a whole snapshot would keep every field's rows in view for its glance. Read at the Aperture chosen: World, Local and Shared
 * read the clearings and gatherings of your circle alone, Federated the whole field (field-lib `scopeWorlds`). */
const fieldWorldsOp = (aperture: Aperture): KernelOp => ({op: 'shared_field', request: {kind: 'worlds', aperture}})
const FIELD_SILENT = 'The shared field gave no answer.'
/** The window's last round trip to the field, in ms, for the transport's Carrier (O-I #858 TX14): set by each read of it, carried on the
 * held field this reader publishes. */
let fieldTripMs: number | null = null
const timedFieldRead = (transport: KernelTransportStatus, op: KernelOp): OwnerRead<OpOutcome<'shared_field_reading'>> => {
  const read = readOp(transport, op, 'shared_field_reading', FIELD_SILENT)
  return async () => { const asked = performance.now(), made = await read(); fieldTripMs = performance.now() - asked; return made }
}
/** The field's refusal as a person reads it: its own words, without the error class a transport wrapped them in. */
const fieldWords = (error: string): string => error.replace(/^(?:(?:Sender)?Error:\s*)+/, '').trim() || FIELD_SILENT

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
  // Worlds, their bodies and page counts are held readings: read once for the window, shared with the tracks that read the same, and
  // read again when the kernel says the ground moved — landing a world is a write whose receipt is that notice, so the act asks for
  // nothing itself.
  const worldsReading = useHeldRead(['worlds', transport], () => readWorlds(transport))
  const worlds = useMemo((): CentralWorldsReading => worldsReading.status === 'answered' && worldsReading.value ? worldsReading.value : {state: 'reading'}, [worldsReading])
  const inSet = useMemo((): CentralWorld[] => worlds.state === 'read'
    ? systemWorlds(worlds.worlds, set.state === 'read' ? set.set.tracks.map(track => track.world) : [])
    : [], [worlds, set])
  const inSetKey = inSet.map(world => `${world.ref}@${world.project ?? ''}@${world.folder}`).join('|')
  const usable = transport.kind === 'unavailable' ? null : transport
  const bodyProjects = useMemo(() => usable ? inSet.flatMap(world => world.project ? [world.project] : []) : [], [usable, inSetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const bodyAnswers = useOwnerReadingsOf(bodyProjects, project => JSON.stringify(['world-body', usable, project]),
    project => async () => ({value: await readBodyOf(kernelWorldBodyOwner(usable!, project))}), epoch)
  const bodies = useStableMap(new Map(inSet.flatMap(world => world.project && bodyAnswers.has(world.project) ? [[world.ref, bodyAnswers.get(world.project)!] as const] : [])))
  /** how many pages and flows each world holds, by the world's ref: the length of its folder's page listing */
  const folders = useMemo(() => usable ? inSet.map(world => world.folder) : [], [usable, inSetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const pageAnswers = useOwnerReadingsOf(folders, folder => JSON.stringify(['world-pages', usable, folder]), folder => async () => ({value: await readWorldPages(usable ?? undefined, {folder})}), epoch)
  const held = useStableMap(new Map(inSet.flatMap(world => {
    const listed = pageAnswers.get(world.folder)
    return listed?.state === 'read' ? [[world.ref, listed.listing.pages.length] as const] : []
  })))
  // each project world's ground, one reader of many held once for the window; none while no carrier stands
  const projects = useMemo(() => (transport.kind === 'unavailable' ? [] : inSet.flatMap(world => (world.project ? [world.project] : []))), [transport, inSetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const projectGrounds = useOwnerReadingsOf(projects, project => projectGroundKey(transport, project), project => readProjectGround(transport, project), epoch)
  // The instrument shows only the sessions you attend to (§16.1 Solo: "you see and hear only them, in the views and the instruments");
  // the others keep running, out of view.
  const soloed = useAgentShellOptional()?.soloed
  const sessionRows = useMemo(() => {
    const attended = soloed ? attendedKeys(sessions?.tracks ?? [], soloed) : null
    const tracks = (sessions?.tracks ?? []).filter(track => !attended || attended.has(trackKey(track)))
    return sessionsOf(tracks, sessions?.rows ?? [], inSet)
  }, [sessions?.tracks, sessions?.rows, inSet, soloed])
  const allBodies = useMemo(() => {
    const merged = new Map(bodies)
    const own = inSet.find(world => world.kind === 'yours')
    if (own) merged.set(own.ref, yourBodyReading(yours))
    return merged
  }, [bodies, inSet, yours])
  // each register's change horizon: what its agents have made, and the oldest change it keeps
  const horizons = useMemo(() => new Map(inSet.map(world => [world.ref, horizonOf(world.project ? projectGrounds.get(world.project) : ground.reading)] as const)), [inSet, projectGrounds, ground.reading])
  const artifacts = useMemo(() => inSet.flatMap(world => artifactsOf(horizons.get(world.ref), world.project)), [inSet, horizons])
  // how lived in each world is: its age, what it holds and how often its space was written, each from its owner, and only where all three are read
  const facts = useMemo(() => new Map(inSet.flatMap(world => {
    const reading = allBodies.get(world.ref)
    const found = worldFactsOf({nowMs, horizon: horizons.get(world.ref), pages: held.get(world.ref), revision: reading?.state === 'read' ? reading.reading.space.revision : null})
    return found ? [[world.ref, found] as const] : []
  })), [inSet, allBodies, horizons, held, nowMs])
  const system = useMemo(() => systemOf({worlds: inSet, bodies: allBodies, sessions: sessionRows, artifacts, nowMs, facts}), [inSet, allBodies, sessionRows, artifacts, nowMs, facts])

  // [O-I #858] the held field for the Field scale: a held answer the kernel scopes `shared-field`, so the field's own news
  // (`shared_field_changed`) retires it and this reader reads it again. Nothing polls the field.
  // The Aperture chosen says how much of the worlds the held client reads (World, Local and Shared your circle, Federated the whole
  // field), so what moves past the edge sends nothing; the field read at the last aperture stands while the next is read.
  const aperture = useSyncExternalStore(subscribeSystem, () => fieldView().aperture)
  const fieldOp = useMemo(() => fieldWorldsOp(aperture), [aperture])
  // the op's held answer as useOwnerOp holds it (one key, one read), each read timed for the transport's Carrier (O-I #858 TX14): timed
  // here, where the field is read, so the first frame's reader (owners/ownerCall.ts) carries nothing for it
  const fieldKey = transport.kind === 'unavailable' ? null : `${opKey(transport, fieldOp)}|shared_field_reading`
  const fieldAnswer = useOwnerReading(fieldKey, timedFieldRead(transport, fieldOp), epoch).reading
  useEffect(() => {
    if (transport.kind === 'unavailable') { publishField({state: 'unavailable', reason: transport.reason}); return }
    if (fieldAnswer.value) { const read = withGone(heldFieldOf(fieldAnswer.value.data)); publishField(read.state === 'read' ? {...read, trip: fieldTripMs} : read) }
    else if (fieldAnswer.status === 'refused') publishField({state: 'unavailable', reason: fieldAnswer.error ?? FIELD_SILENT})
    else if (heldField().state !== 'read') publishField({state: 'reading'})
  }, [transport, fieldAnswer])

  // [O-I #858 SF12, SF13] Software Factory's Runs, read while the Field is the scale drawn (a held answer: an act on a task, a write,
  // retires it), and the units of the Run chosen at a star
  const atField = useSyncExternalStore(subscribeSystem, () => fieldView().field)
  const chosenRun = useSyncExternalStore(subscribeSystem, () => starHand().run)
  const heldNow = useSyncExternalStore(subscribeSystem, heldField)
  // [§17.2] a world of yours showing a live work at a star: the Runs are read wherever the World stands, so this window answers for it
  const keeps = heldNow.state === 'read' && !!heldNow.works?.some(work => liveWork(work) && heldNow.worlds.some(world => world.mine && world.world_ref === work.world_ref))
  const send: Send = op => kernelReadSend(transport, op)
  const runsAnswer = useHeldRead((atField || keeps) && transport.kind !== 'unavailable' ? ['factory-at-star', transport] : null, () => readFactoryRuns(send))
  const runOf = runsAnswer.value?.runs.find(run => run.key === chosenRun) ?? null
  const unitsAnswer = useHeldRead(runOf && transport.kind !== 'unavailable' ? ['factory-run-units', transport, runOf.key] : null, () => readRunUnits(send, runOf!))
  // the state a take goes to: the one chosen on the face while it is still located, else the first located
  const chosenTaker = useSyncExternalStore(subscribeSystem, () => starHand().taker)
  const takers = runsAnswer.value?.takers ?? []
  const takerState = takers.some(taker => taker.statePath === chosenTaker) ? chosenTaker : runsAnswer.value?.takerState ?? null
  const takerPaths = takers.map(taker => taker.statePath)
  const takenAnswer = useHeldRead(takerPaths.length && transport.kind !== 'unavailable' ? ['factory-taken-offers', transport, ...takerPaths] : null, () => readTakenOffers(send, takerPaths))
  useEffect(() => {
    if (transport.kind === 'unavailable') { publishFactory({state: 'unavailable', reason: transport.reason}); return }
    if (runsAnswer.value) {
      const units = !runOf ? null : unitsAnswer.value ? {run: runOf.key, units: unitsAnswer.value} : unitsAnswer.status === 'refused' ? {run: runOf.key, why: unitsAnswer.error ?? FACTORY_SILENT} : null
      publishFactory({state: 'read', runs: runsAnswer.value.runs, takers: runsAnswer.value.takers, takerState, units, taken: takenAnswer.value?.taken ?? null,
        takenAt: takenAnswer.value?.takenAt ?? null, returns: takenAnswer.value?.returns ?? null,
        madeAt: takenAnswer.value?.madeAt ?? null, madeTaker: takenAnswer.value?.madeTaker ?? null,
        ...(takenAnswer.status === 'refused' ? {takenWhy: takenAnswer.error ?? FACTORY_SILENT} : {})})
    } else if (runsAnswer.status === 'refused') publishFactory({state: 'unavailable', reason: runsAnswer.error ?? FACTORY_SILENT})
    else publishFactory({state: 'reading'})
  }, [transport, runsAnswer, unitsAnswer, runOf, takenAnswer, takerState])
  // [SF13] a task revoked in the field that the taker's Factory still holds taken is told to it, once (never held: it narrows reach).
  // The World's binding tells it (atlasDevices.ts relayRevoked), loaded with the binding and not with the window
  const taken = runsAnswer.value && takenAnswer.value
  useEffect(() => {
    if (!taken || heldNow.state !== 'read' || !heldNow.offers?.some(offer => offer.state === 'revoked')) return
    void import('../../../inhabitants/ql/devices/atlasDevices').then(binding => binding.relayRevoked())
  }, [heldNow, taken])
  // [SF13.3c] a task of yours the field shows taken is told to the Factory that made it, once, with the world the field verified took it
  useEffect(() => {
    if (!taken || heldNow.state !== 'read' || !heldNow.offers?.some(offer => offer.state === 'taken' && heldNow.worlds.some(world => world.mine && world.world_ref === offer.world_ref))) return
    void import('../../../inhabitants/ql/devices/atlasDevices').then(binding => binding.relayTaken())
  }, [heldNow, taken])
  // [§17.2] a work your world shows is live while this window answers for it: shown again as its Run moves, and when the field says
  // it answers no more (a reload, or the field's connection made again). Never held: it reaches no further than the field holds
  const runs = runsAnswer.value
  useEffect(() => {
    if (!runs || !keeps) return
    void import('../../../inhabitants/ql/devices/atlasDevices').then(binding => binding.keepShownWorks())
  }, [heldNow, runs, keeps])

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
        // a refusal after the owner wrote (a readback that needs reconciling) leaves its record moved: the write's receipt retires the held body (r21)
        return await landWorld(kernelWorldBodyOwner(transport, body.world.project), body, system.find(entry => entry.yours), allBodies.get(body.world.ref), lat, lon)
      },
      unland: async body => {
        if (transport.kind === 'unavailable') throw Error(transport.reason)
        if (!body.world.project) throw Error(`${body.world.name} is not a project’s world, so no register of its own keeps its body.`)
        return await unlandWorld(kernelWorldBodyOwner(transport, body.world.project), body, allBodies.get(body.world.ref))
      },
      // [O-I #858] an act at a star: one write of the held field through the kernel's `shared_field` op; the field's own news
      // (`shared_field_changed`) then retires the held snapshot, so the World draws what the field did
      fieldAct: async request => {
        if (transport.kind === 'unavailable') throw Error(transport.reason)
        const call = await kernelOp(transport, {op: 'shared_field', request})
        if (call.error) throw Error(fieldWords(call.error))
        const data = call.outcome?.result === 'shared_field_reading' ? call.outcome.data : null
        if (data && typeof data === 'object' && (data as {state?: unknown}).state === 'unavailable') {
          const detail = (data as {detail?: unknown}).detail
          throw Error(typeof detail === 'string' && detail ? detail : FIELD_SILENT)
        }
        return starNote(request, data)
      },
      // [O-I #858 SF12, SF13] a request of Software Factory: its document, or its refusal in its words. A write (an act on a task
      // offered at a star) retires the window's held answers, so the Runs and their shown work are read again behind it
      factory: async request => {
        if (transport.kind === 'unavailable') throw Error(transport.reason)
        return factoryData(await kernelOp(transport, {op: 'factory_owner', request: request as {kind: string}}))
      },
    })
  }, [transport, system, allBodies, opener, selectSession])
  useEffect(() => () => bindSystemActs(null), [])
  return null
}
