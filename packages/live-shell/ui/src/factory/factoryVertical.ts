/** The Factory vertical's join (WORLD-SHELL-DESIGN §17.1; DLW-PLAN Phase 3) — pure.
 *
 * One selected Factory run is recovered through the projections on the SAME
 * identity: the run's ref. Each row below names the owner read it stands on
 * and echoes the run ref it was joined from, so the walk can assert one
 * identity throughout. Nothing here reads the kernel, the wall clock or a
 * store, and nothing is copied into a second store:
 *
 * - the run's subject is the World object its Position holds in custody
 *   (`factory.inhabitation-reading/v1` → custody `work_ref`), never a label;
 * - Earth places the subject only when an atlas occurrence bears it as its
 *   `subject_ref` (the occurrence contract, `field.ts`), otherwise the seam is
 *   named with its owner;
 * - Timeline shows the run's moment only when the temporal reading carries an
 *   event whose subject is the run ref; otherwise the seam is named;
 * - Constellation opens a wiki subject only from a `wiki:node:` ref the run's
 *   own Return text or subject names (the Central rule, `namedWikiSubjects`);
 * - Expressions: the run's live Expression is the desk's own Run Live tab
 *   (`openRunLive`), which composes it from owner reads; nothing is composed here;
 * - devices: each attempt's occupant names its agent session (the owner's
 *   `session` facet); the shell selects that track when the agency reading has it;
 * - files: a Return's `central:path` artifact or subject opens through the owner's
 *   file route; any other ref is named as unopenable with its owner seam.
 *
 * Pure TypeScript. No React, no transport, no timers. */

import {namedWikiSubjects, parseCentralPathRef} from '../central/centralVertical'

// ---------------------------------------------------------------------------
// the owner readings the join reads (structural: the desk's and the owners' own types satisfy these)

/** One Position of a run, from the owner's inhabitation reading (the run's custody and occupants). */
export interface FactoryPositionFacts {
  readonly positionRef: string
  readonly inCustody: boolean
  readonly custody: readonly {readonly state: string; readonly work?: string | null}[]
  readonly occupants: readonly {readonly attemptRef: string; readonly session?: string | null}[]
}

/** The run's own Return for one attempt, from `factory attempt return` (`attempt.record.readableReturn`). */
export interface FactoryReturnFacts {
  readonly attemptRef: string
  readonly returnRef: string
  readonly summary: string
  readonly artifactRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
}

/** A temporal event the kernel's reading gives (TemporalEventRow's fields this join uses). */
export interface FactoryTemporalEvent {
  readonly subject_ref: string
  readonly stream?: string
  readonly summary?: string
  readonly instant_unix_ms?: number | null
}

/** An atlas occurrence's native identity (the occurrence contract's `subject_ref`). */
export interface FactoryEarthOccurrence {
  readonly id: string
  readonly subject_ref?: string
}

/** An attempt the run's inhabitation names, with the agent session the owner's occupant body carries (null when absent). */
export interface FactoryOccupantFacts {
  readonly attemptRef: string
  readonly session: string | null
}

export interface FactoryRunFacts {
  readonly runRef: string
  readonly projectRef: string | null
  readonly positions: readonly FactoryPositionFacts[]
  /** Every occupant the run names, placed in a Position or not. */
  readonly occupants: readonly FactoryOccupantFacts[]
  readonly returns: readonly FactoryReturnFacts[]
}

/** One attempt's `readableReturn` (`factory attempt return`: `attempt.record.readableReturn`), or null when it has none. */
export function returnFactsOf(attemptRef: string, record: {readableReturn?: {returnRef?: unknown; summary?: unknown; artifactRefs?: unknown; evidenceRefs?: unknown} | null} | undefined): FactoryReturnFacts | null {
  const material = record?.readableReturn
  if (!material || typeof material.returnRef !== 'string') return null
  const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return {
    attemptRef,
    returnRef: material.returnRef,
    summary: typeof material.summary === 'string' ? material.summary : '',
    artifactRefs: list(material.artifactRefs),
    evidenceRefs: list(material.evidenceRefs),
  }
}

/** A facet as the owner writes it (`factory.inhabitation-reading/v1`): only a `present` facet carries a value. */
export interface FactoryRawFacet {
  readonly state?: string
  readonly value?: string | null
}

/** One run row of the owner's inhabitation reading, read as the owner writes it (the raw row, not the desk's view:
 * the view keeps only the tail of each custody ref, and the join names the World object by its full ref). */
export interface FactoryRawInhabitationRun {
  readonly run_ref?: string
  readonly positions?: readonly {
    readonly position_ref?: string
    readonly in_custody?: boolean
    readonly custody?: readonly {readonly state?: string; readonly work_ref?: string | null}[]
    readonly attempt_refs?: readonly string[]
  }[]
  readonly occupants?: readonly {
    readonly attempt_ref?: string
    readonly participant?: {readonly position_ref?: FactoryRawFacet}
    readonly body?: {readonly agent_session_ref?: FactoryRawFacet}
  }[]
}

const presentValue = (facet: FactoryRawFacet | undefined): string | null =>
  facet?.state === 'present' && typeof facet.value === 'string' && facet.value.trim() ? facet.value : null

/** The Positions of one run from the owner's raw row. Each Position's occupants are the run's occupants that name it
 * (by the participant's Position facet) or that the Position lists as its attempt. Full refs are kept verbatim. */
export function positionsOfRaw(run: FactoryRawInhabitationRun | undefined): FactoryPositionFacts[] {
  const occupants = (run?.occupants ?? []).filter(item => typeof item.attempt_ref === 'string')
  return (run?.positions ?? []).filter(position => typeof position.position_ref === 'string').map(position => {
    const positionRef = position.position_ref as string
    const mine = occupants.filter(item => presentValue(item.participant?.position_ref) === positionRef || (position.attempt_refs ?? []).includes(item.attempt_ref as string))
    return {
      positionRef,
      inCustody: position.in_custody === true,
      custody: (position.custody ?? []).map(item => ({state: item.state ?? 'unknown', work: item.work_ref ?? null})),
      occupants: mine.map(item => ({attemptRef: item.attempt_ref as string, session: presentValue(item.body?.agent_session_ref)})),
    }
  })
}

/** The attempts a run's inhabitation names, once each, in reading order. */
export function occupantsOfRaw(run: FactoryRawInhabitationRun | undefined): FactoryOccupantFacts[] {
  const found: FactoryOccupantFacts[] = []
  for (const item of run?.occupants ?? []) {
    if (typeof item.attempt_ref !== 'string' || found.some(row => row.attemptRef === item.attempt_ref)) continue
    found.push({attemptRef: item.attempt_ref, session: presentValue(item.body?.agent_session_ref)})
  }
  return found
}

/** The run's facts the join reads: its Positions and occupants (from the owner's raw row) and its Returns. */
export function factsOf(runRef: string, projectRef: string | null, positions: readonly FactoryPositionFacts[], occupants: readonly FactoryOccupantFacts[], returns: readonly FactoryReturnFacts[]): FactoryRunFacts {
  return {runRef, projectRef, positions: [...positions], occupants: [...occupants], returns: [...returns]}
}

export interface FactoryVerticalInputs {
  readonly run: FactoryRunFacts
  /** The temporal reading the World cut holds (empty when none is read). */
  readonly events: readonly FactoryTemporalEvent[]
  /** The atlas occurrences when the Earth is mounted; null when it is not. */
  readonly occurrences: readonly FactoryEarthOccurrence[] | null
  /** The agency reading's session refs (the shell's tracks). */
  readonly sessionRefs: readonly string[]
}

// ---------------------------------------------------------------------------
// the seams: each names its owner, op and remedy (never a guess)

export interface OwnerSeam {
  readonly owner: string
  readonly op: string
  readonly remedy: string
}

export const EARTH_SEAM: OwnerSeam = {
  owner: 'Archetypal-Earth atlas (projections/atlas, Occurrence.subject_ref)',
  op: 'an occurrence whose subject_ref is this Factory work ref',
  remedy: 'the work ref is bound to a corpus occurrence through the T6 occurrence binding contract; the Factory owner declares no such binding today',
}

export const TIMELINE_SEAM: OwnerSeam = {
  owner: 'kernel temporal reading (desktop/cradle/kernel/src/temporal_sources.rs)',
  op: 'a Factory stream adapter reading `factory telemetry day` (factory.telemetry-day/v1) into one moment per run receipt',
  remedy: 'the temporal read has no Factory stream today (its adapters are central-now, central-now-thoughts, wiki-returns, kernel-event-log and aikit-history); the adapter writes nothing, it maps the owner\'s receipt',
}

export const CONSTELLATION_SEAM: OwnerSeam = {
  owner: 'Central wiki (the Constellation, oi:epi-open-knowledge)',
  op: 'a `wiki:node:` ref the run\'s Return or subject names in its own text',
  remedy: 'the Return names no wiki node, and the subject is not a node ref; the Constellation opens only a ref the owner names',
}

export const DEVICE_SEAM: OwnerSeam = {
  owner: 'AIKit agency reading (agency_read)',
  op: 'the agent session an attempt occupies, listed in the agency reading',
  remedy: 'the occupant names no session, or the agency reading does not list it; the device chain stays on its own selection',
}

export const FILE_SEAM: OwnerSeam = {
  owner: 'Factory artifact store (factory attempt return)',
  op: 'a readable file route for the artifact: ref the Return names (no file route admits the artifact: grammar today)',
  remedy: 'Factory declares an artifact read that returns the file or its central:path ref; the Return names artifact refs only',
}

// ---------------------------------------------------------------------------
// the rows

export type FactorySubjectKind = 'central-path' | 'wiki-node' | 'wiki-root' | 'work'

export interface FactorySubject {
  readonly ref: string
  readonly kind: FactorySubjectKind
  readonly positionRef: string
  readonly custodyState: string
}

/** The World objects a run works on: each in-custody Position's custody work refs, once each. */
export function factorySubjectsOf(positions: readonly FactoryPositionFacts[]): FactorySubject[] {
  const found: FactorySubject[] = []
  for (const position of positions) {
    if (!position.inCustody) continue
    for (const item of position.custody) {
      const ref = item.work
      if (!ref || found.some(subject => subject.ref === ref)) continue
      found.push({ref, kind: kindOfRef(ref), positionRef: position.positionRef, custodyState: item.state})
    }
  }
  return found
}

function kindOfRef(ref: string): FactorySubjectKind {
  if (parseCentralPathRef(ref)) return 'central-path'
  if (/^wiki:node:/.test(ref)) return 'wiki-node'
  if (/^central:wiki:/.test(ref)) return 'wiki-root'
  return 'work'
}

export type EarthRow =
  | {readonly state: 'placed'; readonly runRef: string; readonly subject: FactorySubject; readonly occurrenceId: string}
  | {readonly state: 'absent'; readonly runRef: string; readonly subject: FactorySubject; readonly seam: OwnerSeam}
  | {readonly state: 'not-mounted'; readonly runRef: string; readonly seam: OwnerSeam}

export function earthRowsOf(runRef: string, subjects: readonly FactorySubject[], occurrences: readonly FactoryEarthOccurrence[] | null): EarthRow[] {
  if (occurrences === null) return [{state: 'not-mounted', runRef, seam: EARTH_SEAM}]
  return subjects.map((subject): EarthRow => {
    const occurrence = occurrences.find(item => item.subject_ref === subject.ref)
    return occurrence
      ? {state: 'placed', runRef, subject, occurrenceId: occurrence.id}
      : {state: 'absent', runRef, subject, seam: EARTH_SEAM}
  })
}

export type TimelineRow =
  | {readonly state: 'selected'; readonly runRef: string; readonly event: FactoryTemporalEvent}
  | {readonly state: 'absent'; readonly runRef: string; readonly seam: OwnerSeam}

/** The run's moment: the temporal event whose subject is the run ref (first in reading order). */
export function timelineRowOf(runRef: string, events: readonly FactoryTemporalEvent[]): TimelineRow {
  const event = events.find(item => item.subject_ref === runRef)
  return event ? {state: 'selected', runRef, event} : {state: 'absent', runRef, seam: TIMELINE_SEAM}
}

export type ConstellationRow =
  | {readonly state: 'named'; readonly runRef: string; readonly refs: readonly string[]}
  | {readonly state: 'absent'; readonly runRef: string; readonly seam: OwnerSeam}

/** Wiki nodes the run names: `wiki:node:` refs in its Returns' text, and a subject that is itself a node ref. */
export function constellationRowOf(runRef: string, subjects: readonly FactorySubject[], returns: readonly FactoryReturnFacts[]): ConstellationRow {
  const refs: string[] = []
  for (const item of returns) for (const ref of namedWikiSubjects(`${item.summary}\n${item.artifactRefs.join('\n')}`)) if (!refs.includes(ref)) refs.push(ref)
  for (const subject of subjects) if (subject.kind === 'wiki-node' && !refs.includes(subject.ref)) refs.push(subject.ref)
  return refs.length ? {state: 'named', runRef, refs} : {state: 'absent', runRef, seam: CONSTELLATION_SEAM}
}

export interface ExpressionRow {
  readonly runRef: string
  /** The desk's own open door: the Run Live tab of this run's card. The Expression is composed there from owner reads. */
  readonly door: 'desk-run-live'
}

export function expressionRowOf(runRef: string): ExpressionRow {
  return {runRef, door: 'desk-run-live'}
}

export type DeviceRow =
  | {readonly state: 'selected'; readonly runRef: string; readonly attemptRef: string; readonly sessionRef: string}
  | {readonly state: 'absent'; readonly runRef: string; readonly attemptRef: string; readonly seam: OwnerSeam}

/** One device row per attempt the inhabitation reading places in this run; a session the agency reading lists is selected. */
export function deviceRowsOf(runRef: string, occupants: readonly FactoryOccupantFacts[], sessionRefs: readonly string[]): DeviceRow[] {
  return occupants.map((occupant): DeviceRow => occupant.session && sessionRefs.includes(occupant.session)
    ? {state: 'selected', runRef, attemptRef: occupant.attemptRef, sessionRef: occupant.session}
    : {state: 'absent', runRef, attemptRef: occupant.attemptRef, seam: DEVICE_SEAM})
}

export interface FileRef {
  readonly ref: string
  readonly root: string
  readonly path: string
}

export interface FileRows {
  readonly runRef: string
  /** Refs the owner's file route opens (`central:path`), from the Returns and the subjects. */
  readonly openable: readonly FileRef[]
  /** Refs no file route admits, each with its owner seam. */
  readonly unopenable: readonly {readonly ref: string; readonly seam: OwnerSeam}[]
}

export function fileRowsOf(runRef: string, subjects: readonly FactorySubject[], returns: readonly FactoryReturnFacts[]): FileRows {
  const refs: string[] = []
  for (const subject of subjects) if (!refs.includes(subject.ref)) refs.push(subject.ref)
  for (const item of returns) for (const ref of [...item.artifactRefs, ...item.evidenceRefs]) if (!refs.includes(ref)) refs.push(ref)
  const openable: FileRef[] = []
  const unopenable: {ref: string; seam: OwnerSeam}[] = []
  for (const ref of refs) {
    const location = parseCentralPathRef(ref)
    if (location) openable.push({ref, root: location.root, path: location.path})
    else unopenable.push({ref, seam: FILE_SEAM})
  }
  return {runRef, openable, unopenable}
}

// ---------------------------------------------------------------------------
// the whole join

export interface FactoryRunJoin {
  readonly runRef: string
  readonly projectRef: string | null
  readonly subjects: readonly FactorySubject[]
  readonly earth: readonly EarthRow[]
  readonly timeline: TimelineRow
  readonly constellation: ConstellationRow
  readonly expression: ExpressionRow
  readonly devices: readonly DeviceRow[]
  readonly files: FileRows
}

/** The run's recovery through each projection, on its own ref. */
export function factoryRunJoin(inputs: FactoryVerticalInputs): FactoryRunJoin {
  const {run} = inputs
  const subjects = factorySubjectsOf(run.positions)
  return {
    runRef: run.runRef,
    projectRef: run.projectRef,
    subjects,
    earth: earthRowsOf(run.runRef, subjects, inputs.occurrences),
    timeline: timelineRowOf(run.runRef, inputs.events),
    constellation: constellationRowOf(run.runRef, subjects, run.returns),
    expression: expressionRowOf(run.runRef),
    devices: deviceRowsOf(run.runRef, run.occupants, inputs.sessionRefs),
    files: fileRowsOf(run.runRef, subjects, run.returns),
  }
}

/** Every row names the run it was joined from. A row that names another ref is an identity break. */
export function identityBreaks(join: FactoryRunJoin): string[] {
  const rows: {where: string; ref: string}[] = [
    ...join.earth.map((row, index) => ({where: `earth[${index}]`, ref: row.runRef})),
    {where: 'timeline', ref: join.timeline.runRef},
    {where: 'constellation', ref: join.constellation.runRef},
    {where: 'expression', ref: join.expression.runRef},
    ...join.devices.map((row, index) => ({where: `devices[${index}]`, ref: row.runRef})),
    {where: 'files', ref: join.files.runRef},
  ]
  return rows.filter(row => row.ref !== join.runRef).map(row => `${row.where} names ${row.ref}, not ${join.runRef}`)
}
