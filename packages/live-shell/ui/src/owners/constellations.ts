// The constellations of your wiki, as the shell reads them (manual §3: "Whatever you work on, one thing stands in focus: a constellation
// of your wiki, a whole and the things gathered round it, each with its source. Constellations are what last"; §10.3: the browser's
// Material holds "the constellations of your wiki"; decision #709: "the wiki constellations are what persist").
//
// The owner is the Wiki (AIKit's `okf-wiki/v1` registers, disclosed by Central: one register for your world and one for each project).
// This module keeps no reading of its own: it reads the one projection state the Technē centre, the Library and the subject door read
// (desktop/cradle/src/techne/wikiProjectionStore.ts), whose registers are loaded through the owner's own path the frame's wiki standing
// already runs (native/wikiSubjectStanding.ts `liveWikiStandingSource.loadRegisters`: the World's disclosed projects published as the
// registers, each register's reading ensured once per owner access). Every space a register discloses is a constellation, and so is
// every frame constellation (techne/wikiExpression.ts constellationsOf); a child space another register discloses is read in its own
// register, so it is listed there and not twice. A constellation is named by its whole's ref (`wholeRef`): the ref a clip keeps as its
// source.
import {useEffect, useSyncExternalStore} from 'react'
import {getWikiProjectionState, subscribeWikiProjection, wikiProjectionOf, wikiReadingOf, type RegisterStanding}
  from '../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import type {WikiRegister} from '../../../../../desktop/cradle/src/techne/wikiExpression'
import {liveWikiStandingSource} from '../native/wikiSubjectStanding'

export {CONSTELLATION_DRAG} from '../frame/browser/constellationFocus'

export interface ConstellationMember {
  readonly ref: string
  readonly title: string
  /** The sixfold position the wiki itself declares for it, or null. */
  readonly position: number | null
  /** The QL face the wiki declares for that position (`direct`, `prime`), or null (techne/wikiExpression.ts ProjectedMember). */
  readonly face: 'direct' | 'prime' | null
}

/** One constellation of your wiki, as its register discloses it. */
export interface Constellation {
  /** Its whole's ref: the ref a clip keeps as its source. */
  readonly ref: string
  readonly title: string
  /** A frame constellation's own question, where its author gave one. */
  readonly question?: string
  readonly kind: 'space' | 'frame'
  /** A space's own ref (its whole is its anchor): the space a new constellation is made in. Absent on a frame. */
  readonly space?: string
  /** The register that discloses it: "central" (your world) or the project's name. */
  readonly register: string
  /** The project its register's reads are scoped to (the register's own `project`); absent for your world's register. */
  readonly project?: string
  readonly registerTitle: string
  readonly members: readonly ConstellationMember[]
}

export type ConstellationsReading = {
  /** Every constellation the read registers disclose, in register order. */
  readonly rows: readonly Constellation[]
  /** Registers still being read: the rows are not whole until none is. */
  readonly reading: readonly string[]
  /** Registers whose reading the owner refused or could not give, with its words. */
  readonly unread: readonly {readonly register: string; readonly reason: string}[]
  /** No register is disclosed yet (the World has not been read). */
  readonly registers: number
}

const pending = (standing: RegisterStanding | undefined) => !standing || standing.phase === 'idle' || standing.phase === 'reading'

/** The constellations of the projection state's registers. Pure. */
export function constellationsOf(state: {readonly registers: readonly WikiRegister[]; readonly standings: Readonly<Record<string, RegisterStanding>>}): ConstellationsReading {
  const rows: Constellation[] = []
  const reading: string[] = []
  const unread: {register: string; reason: string}[] = []
  const seen = new Map<string, number>()
  for (const register of state.registers) {
    const standing = state.standings[register.key]
    if (standing?.phase === 'unavailable') unread.push({register: register.key, reason: standing.reason})
    else if (pending(standing)) reading.push(register.key)
    const projection = wikiProjectionOf(standing)
    if (!projection) continue
    const frames = wikiReadingOf(standing)?.wiki.constellations ?? []
    for (const constellation of projection.constellations) {
      // A child space is read in its own register; listed there, never twice.
      if (constellation.disclosedChild) continue
      const question = constellation.kind === 'frame' ? frames.find(frame => frame.anchor_ref === constellation.wholeRef)?.question : undefined
      const members = constellation.members.map(member => ({ref: member.subjectRef, title: member.title, position: member.position, face: member.face ?? null}))
      const at = seen.get(constellation.wholeRef)
      if (at !== undefined) {
        // A frame declared round a whole already listed (the Form declares round a space's own whole) is that whole's form: one row,
        // its members on the positions the frame declares, and what the frame gathers beyond the space joined to it.
        if (constellation.kind === 'frame') rows[at] = withFrame(rows[at]!, members, question)
        continue
      }
      seen.set(constellation.wholeRef, rows.length)
      rows.push({ref: constellation.wholeRef, title: constellation.title, ...(question ? {question} : {}), kind: constellation.kind,
        ...(constellation.kind === 'space' && constellation.spaceRef ? {space: constellation.spaceRef} : {}),
        register: register.key, registerTitle: register.title, ...(register.project ? {project: register.project} : {}), members})
    }
  }
  return {rows, reading, unread, registers: state.registers.length}
}

/** A listed whole with the frame declared round it: each member the frame places stands on the frame's position and face (the first
 * listing of it that the frame has not yet placed), a member the frame gathers that the whole does not is added, and the frame's
 * question is the whole's where it has none. Pure. */
function withFrame(row: Constellation, framed: readonly ConstellationMember[], question: string | undefined): Constellation {
  const members = row.members.map(member => ({...member}))
  const placed = new Set<number>()
  for (const member of framed) {
    const i = members.findIndex((candidate, index) => candidate.ref === member.ref && !placed.has(index))
    if (i < 0) { placed.add(members.length); members.push({...member}); continue }
    placed.add(i)
    members[i] = {...members[i]!, position: member.position, face: member.face}
  }
  return {...row, ...(question && !row.question ? {question} : {}), members}
}

/** The constellation a ref names (its whole's ref). Null when no read register discloses it. Pure. */
export function constellationNamed(rows: readonly Constellation[], ref: string | null | undefined): Constellation | null {
  if (!ref) return null
  return rows.find(row => row.ref === ref) ?? null
}

/** The constellation a subject belongs to (Technē's event or World subject, manual §17.1: "Constellation — The event's source"): the one
 * whose whole it is; else the first frame that gathers it, a constellation someone authored round a question; else the first space
 * that gathers it, its register's own whole. Null when none does. Pure. */
export function constellationOfSubject(rows: readonly Constellation[], subjectRef: string | null | undefined): Constellation | null {
  if (!subjectRef) return null
  const gathers = (row: Constellation) => row.members.some(member => member.ref === subjectRef)
  return rows.find(row => row.ref === subjectRef) ?? rows.find(row => row.kind === 'frame' && gathers(row)) ?? rows.find(gathers) ?? null
}

// ---------------------------------------------------------------------------------------------------------------- the reading

let snapshot: {revision: number; reading: ConstellationsReading} | null = null
const current = (): ConstellationsReading => {
  const state = getWikiProjectionState()
  if (snapshot?.revision !== state.revision) snapshot = {revision: state.revision, reading: constellationsOf(state)}
  return snapshot.reading
}

/** The constellations as they stand now (no hook): for an act that reads them once, as Show in Browser does. */
export const constellationsNow = (): ConstellationsReading => current()

let loading: Promise<void> | null = null
let loadFault: string | null = null
const faults = new Set<() => void>()
/** Ask the owner for the registers once (the load is the wiki standing's own, shared with every other reader of it). */
function load(): void {
  if (loading) return
  loading = liveWikiStandingSource.loadRegisters().then(() => { loadFault = null }, cause => {
    loadFault = cause instanceof Error ? cause.message : String(cause)
    loading = null
  }).finally(() => { for (const listener of [...faults]) listener() })
}

/** The constellations of your wiki, read through their owner, and the reason none can be read where the load was refused. */
export function useConstellations(): ConstellationsReading & {readonly fault: string | null} {
  useEffect(() => { load() }, [])
  const reading = useSyncExternalStore(subscribeWikiProjection, current, current)
  const fault = useSyncExternalStore(listener => { faults.add(listener); return () => { faults.delete(listener) } }, () => loadFault, () => loadFault)
  return {...reading, fault}
}
