// The Deck on its owner (DLW §22.4, §24.4; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__deck.tsx,
// `quaternal-logic:deck`). The owner is Quaternal Logic's continuing oracle journey (`ql.nara-oracle-journey/v1`), kept in its Flow page
// and reached through the kernel's nara_journey (desktop/cradle/kernel/src/nara_journey.rs; desktop/cradle/src/nara/journey.ts): QL
// computes, the page keeps the journey on the revision read, and every act that rests on chance — a draw, a cast — needs the person's
// consent to chance, each time; the chance is the kernel's (`getrandom`), never the shell's.
// Owners write, faces read (lock §0.4):
//   theme, journey                      the journey's concern and its page's title (readings: a concern is set when the journey opens);
//   placements                          the latest spread's cards, each by its name and codons, at its position, reversed or not
//                                       (QL's reading: `spreads[].placements[]`; a Klein night with the day it completes);
//   iching                              the latest hexagram's six lines from the bottom and its nuclear hexagram;
//   act.draw · act.cast · act.assign · act.link · act.comment · act.close    the journey's acts, written through the kernel;
//   act.move · act.turn                 refused with their reason: QL's journey has no act that moves or turns a placed card yet.
// Deck, Spread, Draw, Pairs, Lemniscate, Moving lines, Agent reads and Consent are the view's own (DesignBinding.local). Consent to
// chance is spent by the act it allowed: the next draw asks again. With no journey open, every reading stands absent and says why.
// Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {CentralLocation, KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {DeckDefinition, JourneyAct, JourneyRequest, NaraJourneyRequest, NaraJourneyResult, PlacementView, SpreadKind, SpreadView} from '../../../../../../../desktop/cradle/src/nara/journey'
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value, ValueChange} from '../../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import {techneDeviceId, techneFaceDeclaration} from './faces'

export const QL_DECK_FAMILY = 'quaternal-logic'
export const QL_DECK_FACE = 'deck'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'deck'). */
export const QL_DECK_DEVICE_ID = techneDeviceId(QL_DECK_FAMILY, QL_DECK_FACE)

export const NO_JOURNEY = 'No journey is open: open a journey page (a Flow on your practice world) and the Deck reads it.'
export const NO_CONSENT = 'Chance needs your consent: turn Consent on for this act. It is spent by the act it allows.'
export const NO_MOVE = 'QL\'s journey has no act that moves a placed card yet (crates/ql-mef/src/nara/domain/oracle_journey.rs JourneyRequest).'
export const NO_TURN = 'QL\'s journey has no act that turns a placed card yet: a card\'s orientation is the shuffle\'s (oracle_journey.rs DeckShuffle).'
export const CONCERN_SET = 'A journey\'s concern is set when the journey opens; it does not change.'
export const M3_CARD = 'The card of the codon now is the M3 clock\'s (its form\'s tarot): read it on the clock.'

/** The journey the Deck reads: its Flow page, the person who acts and the Day the acts happen on. */
export interface DeckJourney {
  readonly location: CentralLocation
  readonly actor_ref: string
  readonly day_ref: string
  readonly title?: string
  /** A journey's page that holds no journey yet (made from New…): the Deck opens it, by its theme, with consent to chance. */
  readonly unopened?: boolean
  /** Whose journey it is (QL's subject): the person the chosen identity names. Absent, the journey cannot open. */
  readonly subject_ref?: string | null
}

export const NOT_OPENED = 'This journey is not open yet: write its theme, the concern in its deeper form, turn Consent on, and it opens with its one deck, shuffled once by chance.'
export const NO_SUBJECT = 'A journey is yours: choose your identity in the Nara instrument, then open it.'
/** The one deck a journey opens with: the Thoth deck, the person's own practice (Work/personal/Nara-Personal AGENTS.md "Tarot Protocol":
 * "Two Thoth decks, read in sequence"), as QL's DeckDefinition carries it (kernel/src/nara_journey.rs tests). */
export const JOURNEY_DECK: Readonly<DeckDefinition> = Object.freeze({deck_ref: 'deck:thoth', system: 'tarot-thoth', register: 'thoth', extra_cards: [], source_refs: []})

/** Open the journey of a page that holds none (manual §24.4; nara_journey.rs `open`): its concern is the theme written, its one deck the
 * Thoth deck, shuffled once by the kernel's own chance with the consent given for it, which the opening spends. The page is read first
 * for the revision the opening is made on. A refusal comes back in the owner's words. */
export async function openJourneyByTheme(theme: string): Promise<void> {
  const at = state, journey = at.journey
  if (!journey?.unopened) throw new Error(journey ? CONCERN_SET : NO_JOURNEY)
  const title = theme.trim()
  if (!title) throw new Error('A journey opens on its theme: write the concern in its deeper form.')
  if (!journey.subject_ref) throw new Error(NO_SUBJECT)
  if (at.view.consent !== true) throw new Error(NO_CONSENT)
  const ticket = ++sequence
  setState({...at, busy: true, view: {...at.view, consent: false}})
  let revision: string
  try {
    const read = await call({op: 'page', request: {operation: 'read', location: journey.location}})
    const data = (read.outcome as {result?: string; data?: {revision?: string; location?: CentralLocation}} | null | undefined)
    if (data?.result !== 'page_reading' || typeof data.data?.revision !== 'string' || data.data.location?.ref !== journey.location.ref) throw new Error(read.error ?? 'The journey\'s page did not answer its read.')
    revision = data.data.revision
  } catch (error) {
    if (ticket === sequence) setState({...state, busy: false})
    throw error instanceof Error ? error : new Error(String(error))
  }
  const answer = await ask({operation: 'open', location: journey.location, expected_revision: revision, subject_ref: journey.subject_ref,
    concern: {concern_ref: `concern:journey:${journey.location.ref}`, title: title.slice(0, 240), basis_sources: []}, deck: {...JOURNEY_DECK},
    day_ref: journey.day_ref, actor_ref: journey.actor_ref, consent_to_chance: true})
  if (ticket !== sequence) return
  if (!answer.ok) { setState({...state, busy: false}); throw new Error(answer.reason) }
  setState({...state, busy: false, journey: {...journey, unopened: false, title}, result: answer.result, reason: null})
}

export type DeckCall = (op: KernelOp) => Promise<KernelOpCall>

export type DeckAnswer = {readonly ok: true; readonly result: NaraJourneyResult} | {readonly ok: false; readonly reason: string}

/** The owner's answer, admitted only when it is this journey's page and operation. */
export function readDeckAnswer(answer: KernelOpCall, request: NaraJourneyRequest): DeckAnswer {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'The journey\'s owner did not answer.'}
  const outcome = answer.outcome as {result?: string; data?: NaraJourneyResult}
  if (outcome.result !== 'nara_journey' || !outcome.data) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`nara_journey\`.`}
  const data = outcome.data
  if (data.schema !== 'oi.nara-journey/v1' || data.operation !== request.operation || data.page?.location?.ref !== request.location.ref
    || data.reading?.schema !== 'ql.nara-oracle-journey-reading/v1') return {ok: false, reason: 'The journey\'s owner answered another journey or another operation.'}
  return {ok: true, result: data}
}

// ── the store the views share ───────────────────────────────────────────────

export interface DeckView {
  readonly deck?: Value
  readonly spread?: Value
  readonly draw?: Value
  readonly pairs?: Value
  readonly lemniscate?: Value
  readonly movingLines?: Value
  readonly agentReads?: Value
  readonly consent?: Value
}
export const QL_DECK_LOCAL = ['deck', 'spread', 'draw', 'pairs', 'lemniscate', 'movingLines', 'agentReads', 'consent'] as const

export interface QlDeckState {
  readonly journey: DeckJourney | null
  readonly result: NaraJourneyResult | null
  readonly reason: string | null
  readonly busy: boolean
  readonly view: DeckView
}
const INITIAL: QlDeckState = {journey: null, result: null, reason: NO_JOURNEY, busy: false, view: {}}
let state: QlDeckState = INITIAL
let sequence = 0
let call: DeckCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: QlDeckState) => { if (next !== state) { state = next; for (const listener of [...listeners]) listener() } }

export function qlDeckState(): QlDeckState { return state }

async function ask(request: NaraJourneyRequest): Promise<DeckAnswer> {
  try {
    return readDeckAnswer(await call({op: 'nara_journey', request}), request)
  } catch (error) {
    return {ok: false, reason: `The kernel could not be asked for the journey: ${error instanceof Error ? error.message : String(error)}`}
  }
}

/** The journey the Deck reads, from whoever opens a journey page (its Launch, its tab); none: the Deck says so. It is read at once. */
export async function openDeckJourney(journey: DeckJourney | null): Promise<void> {
  const ticket = ++sequence
  if (!journey) { setState({...state, journey: null, result: null, reason: NO_JOURNEY, busy: false}); return }
  // A journey's page made from New… holds no journey until the person opens it: nothing is read, and the Deck asks for its theme.
  if (journey.unopened) { setState({...state, journey, result: null, reason: NOT_OPENED, busy: false}); return }
  setState({...state, journey, result: null, reason: null, busy: true})
  const answer = await ask({operation: 'read', location: journey.location})
  if (ticket !== sequence) return
  setState({...state, busy: false, result: answer.ok ? answer.result : null, reason: answer.ok ? null : answer.reason})
}

/** Read the open journey again (after a write elsewhere). */
export async function readDeck(): Promise<void> {
  if (state.journey) await openDeckJourney(state.journey)
}

/** One of the journey's acts, as the Deck makes it. */
export type DeckAct =
  | {readonly act: 'draw'; readonly spread: SpreadKind}
  | {readonly act: 'cast'; readonly coins: boolean}
  | {readonly act: 'assign'; readonly card: number; readonly reversed: boolean; readonly position: string | null; readonly reason: string}
  | {readonly act: 'link'; readonly placement_ref: string; readonly source: {source_ref: string; revision: string; standing_ref: string}; readonly entry: string | null; readonly relation: string}
  | {readonly act: 'comment'; readonly placement_ref: string; readonly text: string; readonly supersedes?: string | null}
  | {readonly act: 'move' | 'turn'}
  | {readonly act: 'close'; readonly reason: string}

const fresh = (what: string) => `deck:${what}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`}`

/** A position as QL keeps it: P0–P5 on the day arc, P0′–P5′ on the night. */
export function spreadPosition(label: string | null): {arc: 'day' | 'night'; index: number} | null {
  if (label === null) return null
  const match = /^P([0-5])(['′])?$/.exec(label)
  if (!match) throw new Error('A position is P0 to P5, or P0′ to P5′ on the night.')
  return {arc: match[2] ? 'night' : 'day', index: Number(match[1])}
}

/** The QL act for a Deck act on this journey (pure): who acts, when, on which Day. Throws in words for what QL has no act for. */
export function journeyActOf(deck: DeckAct, journey: DeckJourney, result: NaraJourneyResult | null, at: number = Date.now()): JourneyAct {
  const day_ref = journey.day_ref
  let request: JourneyRequest
  switch (deck.act) {
    case 'draw': request = {op: 'draw', spread: deck.spread, day_ref, basis_sources: []}; break
    case 'cast': {
      const concern = result?.reading.concern.concern_ref
      if (!concern) throw new Error(NO_JOURNEY)
      request = {op: 'cast-iching', day_ref, basis_sources: [], related_placement_refs: [], cast: {coins: deck.coins, cast_degree: null, vak_ref: null, hygiene: 'clear',
        query_ref: {ref_id: concern, revision: `journey-revision:${result!.reading.journey_revision}`, owner_ref: 'central'},
        original_payload_ref: {ref_id: journey.location.ref, revision: result!.page.revision, owner_ref: 'central'}}}
      break
    }
    case 'assign': {
      if (!Number.isInteger(deck.card) || deck.card < 0) throw new Error('Assign names a card of the deck.')
      if (!deck.reason.trim()) throw new Error('An assignment says why: it is not a draw and never claims to be.')
      request = {op: 'assign-symbol', card: deck.card, reversed: deck.reversed, position: spreadPosition(deck.position), reason: deck.reason.trim(), day_ref}
      break
    }
    case 'link':
      request = {op: 'relate-event', placement_ref: deck.placement_ref, source: deck.source, entry_selector: deck.entry, relation: deck.relation.trim() || 'linked', occurred_at_unix_ms: at}
      break
    case 'comment': {
      const placed = placementsAll(result).find(placement => placement.placement_ref === deck.placement_ref)
      if (!placed) throw new Error('Comment on a card the journey has placed.')
      if (!deck.text.trim()) throw new Error('A reading has words.')
      const kind = deck.supersedes ? 'correction' : placed.reading_history.length ? 'development' : 'original'
      request = {op: 'read', placement_ref: deck.placement_ref, reading: {reading_ref: fresh('reading'), kind, actor_kind: 'human', author_ref: journey.actor_ref,
        text: deck.text.trim(), supersedes: deck.supersedes ?? null, source_refs: [], occurred_at_unix_ms: at}}
      break
    }
    case 'move': throw new Error(NO_MOVE)
    case 'turn': throw new Error(NO_TURN)
    case 'close': request = {op: 'close', reason: deck.reason.trim() || 'closed'}; break
  }
  return {request_id: fresh(deck.act), actor_ref: journey.actor_ref, at_unix_ms: at, day_ref, request}
}

/** Make one act on the open journey, on the revision its page was read at; the answer is the journey after it. A refusal comes back in
 * the owner's words. A draw or a cast spends the consent given for it. */
export async function deckAct(deck: DeckAct): Promise<void> {
  const at = state, journey = at.journey
  if (!journey || !at.result) throw new Error(at.reason ?? NO_JOURNEY)
  const chance = deck.act === 'draw' || deck.act === 'cast'
  if (chance && at.view.consent !== true) throw new Error(NO_CONSENT)
  const act = journeyActOf(deck, journey, at.result)
  const ticket = ++sequence
  setState({...at, busy: true, ...(chance ? {view: {...at.view, consent: false}} : {})})
  const answer = await ask({operation: 'apply', location: journey.location, expected_revision: at.result.page.revision, act, consent_to_chance: chance})
  if (ticket !== sequence) return
  if (!answer.ok) { setState({...state, busy: false}); throw new Error(answer.reason) }
  setState({...state, busy: false, result: answer.result, reason: null})
}

export function setQlDeckView(view: DeckView): void { setState({...state, view: {...state.view, ...view}}) }

/** Tests: start again, with another call. */
export function resetQlDeck(next: {call?: DeckCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The open journey as the views share it. */
export function useQlDeck(): QlDeckState {
  return useSyncExternalStore(subscribe, qlDeckState, qlDeckState)
}

// ── the design's values and its binding ─────────────────────────────────────

function placementsAll(result: NaraJourneyResult | null): PlacementView[] {
  if (!result) return []
  return [...result.reading.spreads.flatMap(spread => spread.placements), ...result.reading.symbolic_assignments]
}

/** The spread the Deck shows: the latest; a Klein night with the day spread it completes. */
function shownSpreads(spreads: readonly SpreadView[]): SpreadView[] {
  const last = spreads.at(-1)
  if (!last) return []
  if (last.kind.kind === 'klein-night') {
    const dayRef = last.kind.day_spread_ref
    const day = spreads.find(spread => spread.spread_ref === dayRef)
    return day ? [day, last] : [last]
  }
  return [last]
}

const SPREAD_IDS = ['sphere', 'torus-day', 'klein-night'] as const

/** The design's values: the journey's readings and the view's choices. Only what the owner reports. */
export function qlDeckValues(deck: QlDeckState): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of QL_DECK_LOCAL) if (deck.view[key] !== undefined) values[key] = deck.view[key]!
  const result = deck.result
  if (!result) { values.reason = deck.busy ? 'Reading the journey…' : deck.reason ?? NO_JOURNEY; return values }
  const reading = result.reading
  values.theme = reading.concern.title
  values.journey = deck.journey?.title ?? reading.concern.title
  const shown = shownSpreads(reading.spreads)
  const placements = shown.flatMap(spread => spread.placements).filter(placement => placement.position !== null)
    .map(placement => ({position: placement.position!, name: placement.card.name, codons: placement.card.codons, reversed: placement.reversed}))
  if (placements.length) values.placements = JSON.stringify(placements)
  const last = shown.at(-1)
  if (values.spread === undefined && last && (SPREAD_IDS as readonly string[]).includes(last.kind.kind)) values.spread = last.kind.kind
  const hexagram = reading.iching.at(-1)
  if (hexagram && Array.isArray(hexagram.lines) && hexagram.lines.length === 6) values.iching = JSON.stringify({lines: hexagram.lines, nuclear: hexagram.nuclear})
  if (!placements.length && !hexagram) values.reason = reading.status === 'closed' ? 'The journey is closed.' : 'Nothing is drawn yet: press Play to draw, with your consent to chance.'
  return values
}

const json = (value: Value): Record<string, unknown> => {
  if (typeof value !== 'string') throw new Error('The act carries its details as JSON.')
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The act carries its details as a record.')
  return parsed as Record<string, unknown>
}
const spreadOf = (value: Value | undefined): SpreadKind => {
  const id = value ?? 'torus-day'
  if (id === 'sphere' || id === 'torus-day') return {kind: id}
  throw new Error(id === 'klein-night' ? 'A Klein night completes a day spread: draw the day first, then its night by the day spread it completes.' : `${String(id)} is no spread of the Deck.`)
}

/** The Deck act a design change names (the act keys this binding takes). Throws in words. */
export function deckActOf(change: ValueChange, deck: QlDeckState = qlDeckState()): DeckAct {
  const {key, value} = change
  switch (key) {
    case 'act.draw': {
      if (deck.view.spread === 'klein-night') {
        const day = deck.result?.reading.spreads.filter(spread => spread.kind.kind === 'torus-day').at(-1)
        if (!day) throw new Error('A Klein night completes a day spread: draw a Torus first.')
        return {act: 'draw', spread: {kind: 'klein-night', day_spread_ref: day.spread_ref}}
      }
      return {act: 'draw', spread: spreadOf(deck.view.spread)}
    }
    case 'act.cast': return {act: 'cast', coins: value !== 'yarrow'}
    case 'act.assign': { const v = json(value!); return {act: 'assign', card: Number(v.card), reversed: v.reversed === true, position: typeof v.position === 'string' ? v.position : null, reason: String(v.reason ?? '')} }
    case 'act.link': { const v = json(value!), source = v.source as {source_ref: string; revision: string; standing_ref?: string} | undefined
      if (!source?.source_ref || !source.revision) throw new Error('A link names the entry it ties to: its page and revision.')
      return {act: 'link', placement_ref: String(v.placement_ref ?? ''), source: {source_ref: source.source_ref, revision: source.revision, standing_ref: source.standing_ref ?? 'human-flow'},
        entry: typeof v.entry === 'string' ? v.entry : null, relation: String(v.relation ?? 'linked')} }
    case 'act.comment': { const v = json(value!); return {act: 'comment', placement_ref: String(v.placement_ref ?? ''), text: String(v.text ?? ''), supersedes: typeof v.supersedes === 'string' ? v.supersedes : null} }
    case 'act.move': return {act: 'move'}
    case 'act.turn': return {act: 'turn'}
    case 'act.close': return {act: 'close', reason: typeof value === 'string' ? value : 'closed'}
    default: throw new Error(STANDING_WHY[key] ?? `${key}: no act of the journey.`)
  }
}

const NO_CELL = 'The journey\'s reading carries the hexagram\'s lines, not its generation cell: the kernel generates one under a matrix (ql_m3_generate), and the journey does not ask it.'
const ACT_KEYS = ['act.draw', 'act.cast', 'act.assign', 'act.link', 'act.comment', 'act.close']
/** Why each key the binding does not take has no owner write (manual §16.12). */
const STANDING_WHY: Readonly<Record<string, string>> = {theme: CONCERN_SET, journey: 'The Deck reads the journey whose page is open.', placements: 'A reading: cards come by the journey\'s acts.',
  iching: 'A reading: lines come by a cast.', 'm3.card': M3_CARD, 'act.move': NO_MOVE, 'act.turn': NO_TURN, matrix: NO_CELL, generation: NO_CELL}

/** The binding the runtime hosts the Deck design on: the journey's readings, its acts through the kernel, the view's own keys in its
 * own hand, and every key no act takes disabled with the reason. */
export function qlDeckBinding(deck: QlDeckState): DesignBinding {
  const live = !!deck.result && deck.result.reading.status !== 'closed'
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(STANDING_WHY)) standing[key] = {disabled: why}
  if (!live) for (const key of ACT_KEYS) standing[key] = {disabled: deck.reason ?? (deck.result ? 'The journey is closed.' : NO_JOURNEY)}
  else if (deck.view.consent !== true) for (const key of ['act.draw', 'act.cast']) standing[key] = {disabled: NO_CONSENT}
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of QL_DECK_LOCAL) local[key] = value => setQlDeckView({[key]: value})
  // A journey's page that holds no journey yet opens on its theme, with consent to chance (openJourneyByTheme).
  const unopened = !!deck.journey?.unopened && !deck.result
  if (unopened) {
    if (!deck.journey!.subject_ref) standing.theme = {disabled: NO_SUBJECT}
    else if (deck.view.consent !== true) standing.theme = {disabled: NO_CONSENT}
    else delete standing.theme
  }
  return {
    id: QL_DECK_DEVICE_ID,
    values: qlDeckValues(deck),
    waiting: deck.busy && !deck.result,
    writes: key => (live && ACT_KEYS.includes(key)) || (unopened && key === 'theme'),
    standing,
    local,
    ...(live ? {write: async (changes: readonly ValueChange[]) => { for (const change of changes) await deckAct(deckActOf(change, qlDeckState())) }}
      : unopened ? {write: async (changes: readonly ValueChange[]) => {
        for (const change of changes) {
          if (change.key !== 'theme') throw new Error(NOT_OPENED)
          await openJourneyByTheme(typeof change.value === 'string' ? change.value : '')
        }
      }} : {}),
  }
}

// ── the device, for the generic plate that stands in for a view ─────────────

/** The Deck as a device of the runtime: the journey, what is dealt and the last cards as readings; Consent and Draw its two controls. */
export function qlDeckDevice(face: InhabitantFaceDeclaration, deck: QlDeckState): DeviceInstance {
  const live = !!deck.result && deck.result.reading.status !== 'closed'
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_DECK_FAMILY, deviceInstance: face.id, key, title, type, ...rest}) as SdkParamRow
  const write = live ? {writePath: 'kernel:nara_journey'} : {disclosure: deck.reason ?? NO_JOURNEY}
  const rows: SdkParamRow[] = [
    row('journey', 'Journey', 'string', {group: 'Journey', compact: true}),
    row('dealt', 'Dealt', 'number', {group: 'Journey', compact: true}),
    row('last', 'Last cards', 'string', {group: 'Reading'}),
    row('consent', 'Consent to chance', 'boolean', {group: 'Draw', compact: true, ...write}),
    row('act.draw', 'Draw', 'boolean', {group: 'Draw', ...write}),
  ]
  const values: Record<string, ParamValue> = {consent: deck.view.consent === true}
  if (deck.result) {
    const reading = deck.result.reading
    values.journey = deck.journey?.title ?? reading.concern.title
    values.dealt = reading.deck.dealt
    const cards = shownSpreads(reading.spreads).flatMap(spread => spread.placements).map(placement => `${placement.card.name}${placement.reversed ? ' (rev.)' : ''}`)
    if (cards.length) values.last = cards.join(' · ')
  }
  return {
    id: QL_DECK_DEVICE_ID, family: QL_DECK_FAMILY, face: techneFaceDeclaration(face), rows, values,
    ...(live ? {submit: async (changes: readonly {key: string; value: ParamValue}[]) => {
      for (const change of changes) {
        if (change.key === 'consent') setQlDeckView({consent: change.value === true})
        else if (change.key === 'act.draw') { if (change.value === true) await deckAct(deckActOf({key: 'act.draw', value: true}, qlDeckState())) }
        else throw new Error(STANDING_WHY[change.key] ?? `${change.key}: a reading of the journey.`)
      }
    }} : {}),
  }
}
