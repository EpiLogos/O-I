/** The Factory vertical's join (WORLD-SHELL-DESIGN §17.1) — pure.
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
 * - Timeline selects the run's newest moment with a stated instant from the temporal
 *   reading (the factory-runs stream, subject = run ref); otherwise the reading's own
 *   named cause for the stream (owner absent, unreadable, timed out or refused, in the
 *   owner's words) is shown, and the seam alone when the reading names none;
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
import type {Occurrence, OccurrenceBasis} from '../projections/atlas/src/types/field'
import {checkOccurrence, refuse, type Checked} from '../projections/occurrence'

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
  /** The run ref the Return reading itself names (its top-level `runRef`), as the owner returned it; null when it names none. */
  readonly ownerRunRef: string | null
}

/** A temporal event the kernel's reading gives (TemporalEventRow's fields this join uses). */
export interface FactoryTemporalEvent {
  readonly subject_ref: string
  readonly stream?: string
  readonly summary?: string
  readonly instant_unix_ms?: number | null
}

/** An atlas occurrence as the Factory join reads it: the Earth's one occurrence contract (`Occurrence`, field.ts),
 * narrowed to the fields the join uses — its id, its native subject and the basis of the owner reading it came from. */
export type FactoryEarthOccurrence = Pick<Occurrence, 'id' | 'subject_ref' | 'basis'>

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

/** One attempt's `readableReturn` (`factory attempt return`: `attempt.record.readableReturn`), or null when it has none.
 * `ownerRunRef` is the top-level `runRef` of the same Return reading: the run the owner says the attempt belongs to. */
export function returnFactsOf(attemptRef: string, record: {readableReturn?: {returnRef?: unknown; summary?: unknown; artifactRefs?: unknown; evidenceRefs?: unknown} | null} | undefined, ownerRunRef: unknown = null): FactoryReturnFacts | null {
  const material = record?.readableReturn
  if (!material || typeof material.returnRef !== 'string') return null
  const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return {
    attemptRef,
    returnRef: material.returnRef,
    summary: typeof material.summary === 'string' ? material.summary : '',
    artifactRefs: list(material.artifactRefs),
    evidenceRefs: list(material.evidenceRefs),
    ownerRunRef: typeof ownerRunRef === 'string' && ownerRunRef.trim() ? ownerRunRef : null,
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

/** The desk's run view (`RunInhabitationView`, read structurally): its Positions and the attempts no Position names.
 * Its custody keeps the owner's full `workRef`; the tail `work` is a display label and is never read here. */
export interface FactoryViewRun {
  readonly positions: readonly {
    readonly positionRef: string
    readonly inCustody: boolean
    readonly custody: readonly {readonly state: string; readonly workRef?: string}[]
    readonly occupants: readonly {readonly attemptRef: string; readonly session?: string}[]
  }[]
  readonly unplaced: readonly {readonly attemptRef: string; readonly session?: string}[]
}

/** The run's Positions from the desk view. Same identities as `positionsOfRaw` (the raw owner row), read from the view. */
export function positionsOfView(view: FactoryViewRun): FactoryPositionFacts[] {
  return view.positions.map(position => ({
    positionRef: position.positionRef,
    inCustody: position.inCustody,
    custody: position.custody.map(item => ({state: item.state, work: item.workRef ?? null})),
    occupants: position.occupants.map(item => ({attemptRef: item.attemptRef, session: item.session ?? null})),
  }))
}

/** The attempts the run names, once each, from the desk view (placed in a Position, then unplaced). */
export function occupantsOfView(view: FactoryViewRun): FactoryOccupantFacts[] {
  const found: FactoryOccupantFacts[] = []
  for (const item of [...view.positions.flatMap(position => position.occupants), ...view.unplaced]) {
    if (found.some(row => row.attemptRef === item.attemptRef)) continue
    found.push({attemptRef: item.attemptRef, session: item.session ?? null})
  }
  return found
}

export interface FactoryVerticalInputs {
  readonly run: FactoryRunFacts
  /** The temporal reading the World cut holds (empty when none is read). */
  readonly events: readonly FactoryTemporalEvent[]
  /** The atlas occurrences when the Earth is mounted; null when it is not. */
  readonly occurrences: readonly FactoryEarthOccurrence[] | null
  /** The agency reading's session refs (the shell's tracks). */
  readonly sessionRefs: readonly string[]
  /** The streams the temporal reading names as contributing nothing (its `absences`); absent or empty when none. */
  readonly absences?: readonly FactoryStreamAbsence[]
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

/** The Timeline's absence for a run: the field holds no moment for it in the World's window. The field's own rule
 * (temporal_events.rs, a window admits only events with an instant) and its owner-side silence (temporal_sources.rs
 * drops an unreadable Factory owner without a state) mean the two owner reasons below cannot be told apart here. */
export const TIMELINE_SEAM: OwnerSeam = {
  owner: 'kernel temporal reading (desktop/cradle/kernel/src/temporal_sources.rs, the factory-runs stream)',
  op: 'a factory-runs moment for this run with a stated instant, inside the World window (the last seven civil days)',
  remedy: 'the field holds no such moment for this run: its owner states no instant for the signal (an instant-less signal never enters a window), or the Factory owner was unreadable for the window; the field reports neither per run',
}

/** One stream the temporal reading names as silent, with its owner's named cause (`oi.temporal-events/v1` → `absences`).
 * A stream that reads several located sources names the one that failed in `source_ref`. */
export interface FactoryStreamAbsence {
  readonly stream: string
  readonly reason: string
  readonly owner_words: string
  readonly source_ref?: string | null
}

/** The Factory stream's named cause for a run's silence on the Timeline, in the reading's own kind and the owner's words. */
export interface FactoryTimelineAbsence {
  readonly reason: string
  /** The owner's own words, trimmed; empty when the owner stated none. */
  readonly ownerWords: string
  /** The reason in the Timeline's words, the owner's words included. */
  readonly text: string
  /** The located source the failure names, when the reading names one. */
  readonly sourceRef: string | null
}

const FACTORY_RUNS_STREAM = 'factory-runs'

/** The Timeline's words for each owner state kind. A kind this face does not know is named as it arrives. */
const ABSENCE_LABEL: Readonly<Record<string, string>> = {
  'owner-absent': 'The Factory owner is absent here',
  'owner-unreadable': 'The Factory owner answered, and the field could not read the answer',
  'owner-timeout': 'The Factory owner did not answer within its bound',
  refused: 'The Factory owner refused the reading',
}

function timelineAbsenceOf(item: FactoryStreamAbsence): FactoryTimelineAbsence {
  const base = ABSENCE_LABEL[item.reason] ?? `The Factory owner contributed nothing (${item.reason})`
  const sourceRef = item.source_ref?.trim() ? item.source_ref.trim() : null
  const label = sourceRef ? `${base} (source ${sourceRef})` : base
  const words = item.owner_words.trim()
  return {reason: item.reason, ownerWords: words, sourceRef, text: words ? `${label}: ${words}` : `${label}; the owner stated no words`}
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
  | {readonly state: 'placed'; readonly runRef: string; readonly subject: FactorySubject; readonly occurrenceId: string; readonly basis?: OccurrenceBasis}
  | {readonly state: 'absent'; readonly runRef: string; readonly subject: FactorySubject; readonly seam: OwnerSeam}
  | {readonly state: 'not-mounted'; readonly runRef: string; readonly seam: OwnerSeam}

export function earthRowsOf(runRef: string, subjects: readonly FactorySubject[], occurrences: readonly FactoryEarthOccurrence[] | null): EarthRow[] {
  if (occurrences === null) return [{state: 'not-mounted', runRef, seam: EARTH_SEAM}]
  return subjects.map((subject): EarthRow => {
    const occurrence = occurrences.find(item => item.subject_ref === subject.ref)
    return occurrence
      ? {state: 'placed', runRef, subject, occurrenceId: occurrence.id, ...(occurrence.basis ? {basis: occurrence.basis} : {})}
      : {state: 'absent', runRef, subject, seam: EARTH_SEAM}
  })
}

/** The Factory side of the occurrence contract: an occurrence the Factory owner declares for one work ref, checked by
 * the one contract (`checkOccurrence`) and carrying the basis of the Factory reading it was read from. The owner
 * declares no binding today (EARTH_SEAM), so a caller with nothing declared has nothing to admit. The reading's basis
 * replaces any basis the binding carries: the reading the join read it from is the one that stands. */
export function factoryEarthOccurrence(binding: unknown, reading: {readonly subjectRef: string; readonly basis: OccurrenceBasis}): Checked<Occurrence> {
  if (typeof binding !== 'object' || binding === null) return refuse('the Factory binding is not an occurrence')
  const checked = checkOccurrence({...binding, basis: reading.basis})
  if (!checked.ok) return checked
  if (checked.value.subject_ref !== reading.subjectRef) {
    return refuse(`the occurrence binds ${checked.value.subject_ref ?? 'no subject'}, not the run's work ${reading.subjectRef}`)
  }
  return checked
}

export type TimelineRow =
  | {readonly state: 'selected'; readonly runRef: string; readonly event: FactoryTemporalEvent}
  | {readonly state: 'absent'; readonly runRef: string; readonly seam: OwnerSeam; readonly absence?: FactoryTimelineAbsence}

/** The run's moment: the newest event on the run's ref that the World's temporal reading holds with a stated instant.
 * An event without an instant cannot be placed on the Timeline's instant axis, so it is never selected.
 * When no moment is held and the reading names a `factory-runs` absence, the row says that reason; otherwise it is the
 * seam alone (the owner's remedy, as before). */
export function timelineRowOf(runRef: string, events: readonly FactoryTemporalEvent[], absences: readonly FactoryStreamAbsence[] = []): TimelineRow {
  let moment: FactoryTemporalEvent | null = null
  for (const item of events) {
    const instant = item.instant_unix_ms
    if (item.subject_ref !== runRef || typeof instant !== 'number') continue
    if (moment === null || instant > (moment.instant_unix_ms as number)) moment = item
  }
  if (moment) return {state: 'selected', runRef, event: moment}
  const named = absences.find(item => item.stream === FACTORY_RUNS_STREAM)
  return named
    ? {state: 'absent', runRef, seam: TIMELINE_SEAM, absence: timelineAbsenceOf(named)}
    : {state: 'absent', runRef, seam: TIMELINE_SEAM}
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

/** One identity an owner read returned, set against the identity its row was joined on. The rows are built from the
 * run, so the check is on the refs the owner reads returned, which the join records as it reads them. */
export interface FactoryIdentityRecord {
  /** The row or fact the read fed: `earth[i]`, `timeline`, `return[attempt]`, `devices[i]`, `files[i]`. */
  readonly where: string
  /** The owner read the ref came from, in the reader's words (no parentheses). */
  readonly owner: string
  /** The ref the owner's read returned, verbatim. */
  readonly ownerRef: string
  /** The identity the row was joined on: the run, or the subject the run holds in custody. */
  readonly joinedOn: string
}

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
  /** Every owner-returned identity this join read, each with the identity it was joined on. */
  readonly identity: readonly FactoryIdentityRecord[]
}

/** The owner-returned identities of one join: the Earth's occurrence ref, the temporal answer's subject, each Return
 * reading's run, the agency's session for an occupant, and each file ref the Return or the subject names. */
function identityOf(inputs: FactoryVerticalInputs, earth: readonly EarthRow[], timeline: TimelineRow, devices: readonly DeviceRow[], files: FileRows): FactoryIdentityRecord[] {
  const runRef = inputs.run.runRef
  const records: FactoryIdentityRecord[] = []
  earth.forEach((row, index) => {
    if (row.state !== 'placed') return
    const occurrence = inputs.occurrences?.find(item => String(item.id) === row.occurrenceId)
    records.push({where: `earth[${index}]`, owner: 'Earth atlas, occurrence subject_ref', ownerRef: occurrence?.subject_ref ?? '', joinedOn: row.subject.ref})
  })
  if (timeline.state === 'selected') records.push({where: 'timeline', owner: 'temporal reading, factory-runs subject_ref', ownerRef: timeline.event.subject_ref, joinedOn: runRef})
  for (const item of inputs.run.returns) {
    if (item.ownerRunRef !== null) records.push({where: `return[${item.attemptRef}]`, owner: 'Return reading, run_ref', ownerRef: item.ownerRunRef, joinedOn: runRef})
  }
  devices.forEach((row, index) => {
    if (row.state !== 'selected') return
    const listed = inputs.sessionRefs.find(ref => ref === row.sessionRef) ?? ''
    records.push({where: `devices[${index}]`, owner: 'agency reading, session_ref', ownerRef: listed, joinedOn: row.sessionRef})
  })
  files.openable.forEach((file, index) => records.push({where: `files[${index}]`, owner: 'Return or subject, central:path ref', ownerRef: file.ref, joinedOn: `central:path:${file.root}:${file.path}`}))
  return records
}

/** The run's recovery through each projection, on its own ref. */
export function factoryRunJoin(inputs: FactoryVerticalInputs): FactoryRunJoin {
  const {run} = inputs
  const subjects = factorySubjectsOf(run.positions)
  const earth = earthRowsOf(run.runRef, subjects, inputs.occurrences)
  const timeline = timelineRowOf(run.runRef, inputs.events, inputs.absences ?? [])
  const devices = deviceRowsOf(run.runRef, run.occupants, inputs.sessionRefs)
  const files = fileRowsOf(run.runRef, subjects, run.returns)
  return {
    runRef: run.runRef,
    projectRef: run.projectRef,
    subjects,
    earth,
    timeline,
    constellation: constellationRowOf(run.runRef, subjects, run.returns),
    expression: expressionRowOf(run.runRef),
    devices,
    files,
    identity: identityOf(inputs, earth, timeline, devices, files),
  }
}

/** Each owner read's returned identity, set against the identity its row was joined on. An identity break is a read
 * that returned another identity: a Return reading naming another run, a file ref that the file route does not
 * round-trip, and so on. An absent read records nothing, so it is never a break. */
export function identityBreaks(join: FactoryRunJoin): string[] {
  return join.identity
    .filter(record => record.ownerRef !== record.joinedOn)
    .map(record => `${record.where} (${record.owner}) names ${record.ownerRef || 'no ref'}, not ${record.joinedOn}`)
}
