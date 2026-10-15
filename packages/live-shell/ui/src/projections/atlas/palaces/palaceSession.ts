// The palace you stand in (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4; lane-5 T14–T21, T24). One store the M5 Palace / Integral Whole
// plate and the atlas's floor plan both read, and every act on the palace, each through its owner.
//
// Ported from the frame's Palace lens, which retires (field-studies-journeys/src/palaceInstrument.tsx at fdc302870, `PalacePanel`
// :125-601 and `installPalaceInstrument` :611-668): its state and its acts moved out of one React panel into this store, unchanged in
// law, so the plate (its controls) and the pane (the floor plan, the palace drawn inside) read one palace. Each act names the line it
// ports. What changed is only the host seam:
//   - the palace is the Expression of a Technē register, entered from the world (palacesModel.ts), not the Expression the stage has
//     open; its basis is the owner's inspected document at one of its own Scenes (basis.ts palaceBasisOf), not the frame's conversion;
//   - the owners are the candidate's own, bound by the host (palaceOwners.ts): the kernel's `expression` op for inspect, list and the
//     one CAS-gated edit; the owner's integral reading (wikiReadingProvider.ts readWikiSceneTechne, scope "expression"); the routed
//     Return through the `kernel-expression` channel's invoke_action (packages/expressions-boundary/src/cradle.ts:124); the presence
//     store over the atlas's workspace memory; the shell's own doors to open an object;
//   - "Return to ground" re-opens M0′, which in the shell is the Earth itself (lock §0.1.3: "Technē's 0 instrument is the Earth and solar
//     system together with its graph view"): leaving the palace is the return.
//
// Laws kept from the frame: the kernel Expression is the only store of record (a region is a real Scene of the palace's Expression,
// one Save is one CAS-gated edit diffed against the live document, its readback is checked); presentation (the board, the walk, the
// bookmarks) persists only through the presence owner and never touches the Expression; proposing a Return writes nothing; every
// refusal is said in the owner's words; nothing is opened on the palace's behalf that its own route refuses.

import {validateReading, type TechneInstrument, type TechneReading} from '../../../../../../../desktop/cradle/src/techne/contract'
import type {DisclosureSessionStore} from '../../../../../../../desktop/cradle/src/techne/session'
import type {PresenceStorage} from '../../../../../../../desktop/cradle/src/techne/m0m5/journey/presence'
import {discoverRegions, planRegions, regionSceneRef, type PalaceRegionSpec} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/composition'
import {palaceComposition, removeBookmark, storeComposition, type PalaceBoardViewport, type PalaceBookmark, type PalaceComposition} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/palace-state'
import {PALACE_UNPERSISTED_NOTICE, restorePalaceComposition, savePalaceComposition} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/presence'
import {palaceAcceptOutcome, palaceAcceptRequest, palaceReturnProposal, returnGroundInstrument, type PalaceReturnProposal} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/return'
import type {PalaceRegionEntry} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/regions'
import {PALACE_WIRED_INSTRUMENTS, palaceOpenRoute, palaceRegionOpenRoute, palaceWalkAt, palaceWalkSteps, type PalaceWalkStep} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import {palaceBookmarkAdd, palaceBookmarkJump, palaceBookmarkLabel, palaceBookmarkRename, palaceLandingIndex, palaceStartStep} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/bookmarks'
import {boardSelectionLine, forgetBoardRegion, moveBoardRegion, snapBoardPoint, validateBoardPositions, type BoardPoint, type BoardPositions} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/board'
import {assertPalaceSource, palaceBasisOf, palaceComposeReply, palaceEditRequest, palaceSnapshot, palaceTrailStep, samePalaceComposition, type PalaceBasis, type PalaceDocument} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/basis'
import {composedRooms, roomOfStep, roomsOf, type PalaceRoom, type PalaceRow} from './palacesModel'

// ── the owners ────────────────────────────────────────────────────────────

/** An Expression the kernel lists, as a region may hold it. */
export interface PalaceListedExpression {expression_ref: string; title: string; revision: number}

/** Where the shell opens an object, each through its owner (palaceOwners.ts binds the live ones). Each says what it did, or throws the owner's refusal. */
export interface PalaceOpeners {
  /** an Expression, in the stage (the App's own open door) */
  expression(ref: string): string
  /** one of the palace's Scenes, in the stage (the owner's selection ask, as the subject door posts it) */
  scene(palace: Pick<PalaceRow, 'key' | 'title'>, room: Pick<PalaceRoom, 'key' | 'name'>): string
  /** a subject, in the Scene that carries it (the subject door) */
  subject(ref: string, title: string): string
  /** a deep instrument, with the ref as its pane's subject (the instrument door) */
  instrument(instrument: TechneInstrument, ref: string): string
  /** a source, on its own surface */
  source(ref: string): string
}

export interface PalaceOwners {
  /** the kernel's `expression` op, inspect: the palace's document (raw) */
  inspect(expressionRef: string): Promise<unknown>
  /** the owner's Expression-wide reading at an exact basis (readWikiSceneTechne, scope "expression") */
  readWhole(basis: PalaceBasis): Promise<unknown>
  /** the kernel's Expressions, for a region's member */
  list(): Promise<PalaceListedExpression[]>
  /** the one CAS-gated edit (raw reply) */
  edit(request: ReturnType<typeof palaceEditRequest>): Promise<unknown>
  /** the routed Return: the kernel-expression channel's invoke_action (raw reply) */
  invoke(request: Record<string, unknown>): Promise<unknown>
  /** open the register's Expression in the kernel when it is not held yet (the owner's own open); resolves to the Expression's ref */
  hold(registerKey: string): Promise<string>
  /** the register's projection: which Scene is its overview, which its constellations */
  projection(registerKey: string): {overviewSceneRef: string; constellations: readonly {sceneRef: string}[]} | undefined
  /** the storage the presence store writes */
  storage(): PresenceStorage | null
  /** the shared session a trail step records on */
  readonly session: DisclosureSessionStore
  readonly open: PalaceOpeners
}

let owners: PalaceOwners | null = null

/** Bind (or, with null, release) the owners. Unbound, entering a palace is refused by name. */
export function bindPalaceOwners(next: PalaceOwners | null): void {
  owners = next
  if (!next && state.phase !== 'outside') set({phase: 'outside', line: 'The Earth closed, so the palace was left.'})
}

// ── the state ─────────────────────────────────────────────────────────────

/** One region of the draft composition (palaceInstrument.tsx:115 RegionDraft). */
type RegionDraft = PalaceRegionSpec

export interface PalaceInside {
  readonly phase: 'inside'
  readonly palace: PalaceRow
  /** the live document the palace stands at */
  readonly doc: PalaceDocument
  /** the rooms the owner's document holds (overview, constellations, saved regions, other Scenes), with their members */
  readonly savedRooms: readonly PalaceRoom[]
  /** the document the draft began at (palaceInstrument.tsx:126 draftDoc) */
  readonly draftDoc: PalaceDocument
  readonly basis: PalaceBasis
  /** undefined while the whole's reading is returning; null when the owner refused it (readingReason says why) */
  readonly reading: TechneReading | null | undefined
  readonly readingReason: string | null
  readonly regions: readonly RegionDraft[]
  readonly removed: readonly string[]
  readonly eligible: readonly PalaceListedExpression[]
  readonly eligibleKnown: boolean
  readonly busy: boolean
  readonly held: BoardPositions
  readonly selected: readonly string[]
  readonly viewport: PalaceBoardViewport | null
  readonly snap: boolean
  /** the mockup's Path (m5.path): guided draws the path and the walk's focus on the floor; free leaves the rooms to be entered in any
   * order (palace-state.ts:233 "Free exploration is the same palace entered directly — the traversal is an ordering, never a gate") */
  readonly path: 'guided' | 'free'
  /** the mockup's Guide (m5.guide): the guide says why the focused room stands where it does (T18) */
  readonly guide: boolean
  readonly walkMoved: number | undefined
  readonly walking: boolean
  readonly bookmarks: readonly PalaceBookmark[]
  readonly proposal: PalaceReturnProposal | null
  readonly acceptance: {readonly line: string; readonly accepted: boolean} | null
  readonly accepting: boolean
  /** the one status line (palaceInstrument.tsx:622 message) */
  readonly line: string | null
}

export type PalaceState =
  | {readonly phase: 'outside'; readonly line?: string | null}
  | {readonly phase: 'entering'; readonly palace: PalaceRow; readonly line?: string | null}
  | PalaceInside

let state: PalaceState = {phase: 'outside'}
let generation = 0
const listeners = new Set<() => void>()

function set(next: PalaceState): void {
  state = next
  for (const listener of [...listeners]) listener()
}

export function palaceState(): PalaceState {
  return state
}

export function subscribePalace(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The palace stood in, or null. */
export function inside(): PalaceInside | null {
  return state.phase === 'inside' ? state : null
}

function patch(next: Partial<PalaceInside>, guard = generation): void {
  if (guard !== generation || state.phase !== 'inside') return
  set({...state, ...next})
}

function say(line: string | null, guard = generation): void {
  if (guard !== generation) return
  set({...state, line} as PalaceState)
}

/** Say a line on the palace's status line (a door's late answer). */
export function sayLine(line: string): void {
  say(line)
}

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

// ── readings derived from the state ───────────────────────────────────────

/** The rooms the palace shows now: the owner's rooms, with the draft's regions in place of the saved ones. */
export function roomsNow(inside: Pick<PalaceInside, 'savedRooms' | 'doc' | 'regions'>): PalaceRoom[] {
  return composedRooms(inside.savedRooms, inside.doc.expression_ref, inside.regions)
}

/** The walk over the integral whole (palaceInstrument.tsx:192-198): its steps, where it stands (the visitor's move, else the saved
 * position, else the named start), and the step focused. */
export function walkOf(inside: Pick<PalaceInside, 'reading' | 'walkMoved'>): {steps: PalaceWalkStep[]; index: number; focus: PalaceWalkStep | null} {
  const steps = palaceWalkSteps(inside.reading ?? null)
  const landing = palaceLandingIndex(inside.reading ? palaceComposition(inside.reading).walk_index : undefined, steps)
  const index = palaceWalkAt(steps, inside.walkMoved ?? landing).index
  return {steps, index, focus: palaceWalkAt(steps, index).step}
}

/** The room the walk stands in, by its focused step (T17 on the floor). */
export function focusedRoom(inside: PalaceInside): string | null {
  return roomOfStep(roomsNow(inside), walkOf(inside).focus?.ref ?? null)
}

/** The live Expression refs, null until the owner's list is known (palaceInstrument.tsx:181): a member is never called broken on a
 * list that has not yet arrived. */
export function liveRefs(inside: Pick<PalaceInside, 'eligible' | 'eligibleKnown' | 'doc'>): ReadonlySet<string> | null {
  return inside.eligibleKnown ? new Set([...inside.eligible.map(entry => entry.expression_ref), inside.doc.expression_ref]) : null
}

// ── entering and leaving ──────────────────────────────────────────────────

/** The Scene the whole is read through: the register's overview, else its first Scene. */
function wholeSceneOf(doc: PalaceDocument, registerKey: string): string | null {
  const overview = owners?.projection(registerKey)?.overviewSceneRef
  if (overview && doc.scenes.some(scene => scene.scene_ref === overview)) return overview
  return doc.scenes[0]?.scene_ref ?? null
}

/** T14: the Expression-wide reading the integral whole composes from (palaceInstrument.tsx:627 readWhole). Never throws: a reading
 * that is absent, invalid or for another basis is refused by name, and the rest of the palace still stands. */
async function readWhole(basis: PalaceBasis): Promise<{reading: TechneReading | null; reason: string | null}> {
  try {
    const raw = await owners!.readWhole(basis)
    const validation = validateReading(raw)
    if (!validation.valid) throw Error(`The native Palace reading is invalid: ${validation.errors.join('; ')}`)
    const reading = raw as TechneReading
    // the frame's scope check (researchInstrumentsData.ts assertInstrumentReadingScope), at this host's basis: the reading answers
    // for this palace's own Expression, and every binding it carries is one of its Scenes at this revision
    if (reading.subject.subject_ref !== basis.expression_ref || (reading.expressions ?? []).some(binding => binding.expression_ref !== basis.expression_ref || binding.revision !== String(basis.revision))) {
      throw Error('The Palace reading belongs to another native source or revision')
    }
    return {reading, reason: null}
  } catch (error) {
    return {reading: null, reason: messageOf(error)}
  }
}

/** Enter a palace, optionally at one of its rooms (a door the Earth stands at): its document, then its whole, then its saved presence
 * (palaceInstrument.tsx:636-657 load). A palace the owner refuses stays outside, said in the owner's words. */
export async function enterPalace(palace: PalaceRow, at: {roomKey?: string} = {}): Promise<void> {
  const guard = ++generation
  stopWalking()
  if (!owners) { set({phase: 'outside', line: 'The Earth is not open, so no palace can be entered. Open Earth from the browser\'s Instruments.'}); return }
  set({phase: 'entering', palace, line: `Entering ${palace.title}…`})
  try {
    // the register's Expression, held by the kernel (or opened by its owner first: wikiNativeExpression.ts ensureWikiNativeExpression)
    const ref = palace.held && palace.expression_ref ? palace.expression_ref : await owners.hold(palace.key)
    if (guard !== generation) return
    const raw = await owners.inspect(ref)
    if (guard !== generation) return
    const doc = palaceSnapshot(raw)
    const sceneRef = wholeSceneOf(doc, palace.key)
    if (!sceneRef) throw Error(`${palace.title} has no Scene to stand in: its Expression holds no room`)
    const basis = palaceBasisOf(doc, sceneRef)
    assertPalaceSource(doc, basis)
    const savedRooms = roomsOf(raw as Parameters<typeof roomsOf>[0], owners.projection(palace.key))
    const regions = discoverRegions(doc)
    set({phase: 'inside', palace, doc, savedRooms, draftDoc: doc, basis, reading: undefined, readingReason: null, regions, removed: [],
      eligible: [], eligibleKnown: false, busy: false, held: {}, selected: [], viewport: null, snap: false, path: 'guided', guide: true, walkMoved: undefined, walking: false,
      bookmarks: [], proposal: null, acceptance: null, accepting: false, line: null})
    void listEligible(guard)
    // The rooms stand at once; the integral whole follows when its reading returns.
    const whole = await readWhole(basis)
    if (guard !== generation || state.phase !== 'inside') return
    // T21: the saved arrangement, walk position and bookmarks come back before the palace is drawn; the notice is said once.
    let line: string | null = null, composition: PalaceComposition | null = null
    if (whole.reading) {
      const restored = restorePalaceComposition(whole.reading, owners.storage())
      composition = restored.composition
      if (restored.notice) line = restored.notice
    }
    const keys = roomsNow({savedRooms, doc, regions}).map(room => room.key)
    const steps = palaceWalkSteps(whole.reading)
    const carried = at.roomKey ? steps.findIndex(step => step.ref === at.roomKey) : -1
    if (at.roomKey && carried < 0 && whole.reading) line = `${line ? `${line} ` : ''}Entered at the named start: the walk does not stand in that room.`
    patch({reading: whole.reading, readingReason: whole.reason,
      held: composition ? validateBoardPositions(composition.board, keys) ?? {} : {},
      viewport: composition?.viewport ?? null, bookmarks: composition?.bookmarks ?? [],
      ...(carried >= 0 ? {walkMoved: carried} : {}), line}, guard)
  } catch (error) {
    if (guard !== generation) return
    set({phase: 'outside', line: `${palace.title} was not entered: ${messageOf(error)}`})
  }
}

/** Leave the palace for the Earth (the outside, M0′). */
export function leavePalace(line: string | null = null): void {
  ++generation
  stopWalking()
  flushViewport()
  set({phase: 'outside', line})
}

async function listEligible(guard: number): Promise<void> {
  if (!owners) return
  try {
    const list = await owners.list()
    const here = inside()
    if (!here) return
    patch({eligible: list.filter(entry => entry.expression_ref !== here.doc.expression_ref), eligibleKnown: true}, guard)
  } catch (error) {
    say(messageOf(error), guard)
  }
}

// ── T17: the walk, on the one transport ───────────────────────────────────

/** How long the walk dwells at a locus while it walks (the transport's Walk pace). No owner sets a pace yet: the walk's own dwell. */
export const PALACE_WALK_DWELL_MS = 6000
let walkTimer: ReturnType<typeof setInterval> | null = null

/** Session presentation saved on change (palaceInstrument.tsx:263 persist): the walk, the board and the bookmarks persist through
 * the palace's presence owner; a refused store is told once. */
let persistFailed = false
function persist(next: PalaceComposition, reading: TechneReading): void {
  storeComposition(next)
  if (!savePalaceComposition(owners?.storage() ?? null, next, reading) && !persistFailed) {
    persistFailed = true
    say(PALACE_UNPERSISTED_NOTICE)
  }
}

/** Move the walk (palaceInstrument.tsx:208 moveWalk): normalised with wrap, and the position rides the presence composition. */
export function moveWalk(next: number): void {
  const here = inside()
  if (!here) return
  const {steps} = walkOf(here)
  const index = palaceWalkAt(steps, next).index
  patch({walkMoved: index})
  if (here.reading) persist({...palaceComposition(here.reading), walk_index: index}, here.reading)
}

export function stepWalk(delta: number): void {
  const here = inside()
  if (here) moveWalk(walkOf(here).index + delta)
}

/** T24: jump to the named start — the first step of the walk. */
export function walkToStart(): void {
  const here = inside()
  if (here) moveWalk(palaceStartStep(walkOf(here).steps).index)
}

/** Play walks: one locus per dwell, wrapping, until Stop. A walk of nothing is not walked. */
export function startWalking(): void {
  const here = inside()
  if (!here || walkTimer) return
  if (!walkOf(here).steps.length) { say('Nothing stands in the whole, so the walk focuses nothing.'); return }
  walkTimer = setInterval(() => stepWalk(1), PALACE_WALK_DWELL_MS)
  ;(walkTimer as {unref?: () => void}).unref?.()
  patch({walking: true})
}

/** Stop holds the walk still where it stands (T17's craft bar: a walk may hold still at a locus). */
export function stopWalking(): void {
  if (walkTimer) clearInterval(walkTimer)
  walkTimer = null
  if (state.phase === 'inside' && state.walking) set({...state, walking: false})
}

// ── T24: bookmarks and the named start ────────────────────────────────────

function commitBookmarks(next: PalaceComposition, reading: TechneReading): void {
  persist(next, reading)
  patch({bookmarks: next.bookmarks})
}

/** Bookmark the focused walk position under a name, with the floor's viewport (palaceInstrument.tsx:274 addBookmarkHere). */
export function bookmarkHere(name: string): boolean {
  const here = inside()
  const focus = here ? walkOf(here).focus : null
  if (!here?.reading || !focus) return false
  const change = palaceBookmarkAdd(palaceComposition(here.reading), focus, name, here.viewport)
  if (change.kind === 'refused') { say(`Not bookmarked: ${change.reason}.`); return false }
  commitBookmarks(change.composition, here.reading)
  say(`Bookmarked ${name.trim()} at ${focus.office} · ${focus.ref}.`)
  return true
}

/** A jump is one hop: the walk index, the focus and the viewport arrive together and are saved once (palaceInstrument.tsx:283). */
export function jumpBookmark(bookmark: PalaceBookmark): void {
  const here = inside()
  if (!here?.reading) return
  const {steps} = walkOf(here)
  const result = palaceBookmarkJump(palaceComposition(here.reading), bookmark, steps)
  if (result.kind === 'refused') { say(`Not jumped: ${result.reason}.`); return }
  patch({walkMoved: result.walk_index, ...(result.viewport ? {viewport: {...result.viewport}} : {})})
  commitBookmarks(result.composition, here.reading)
  say(`Jumped to ${palaceBookmarkLabel(bookmark)}: locus ${result.walk_index + 1} of ${steps.length}, ${result.focus.office} · ${result.focus.ref}.`)
}

export function renameBookmark(ref: string, name: string): boolean {
  const here = inside()
  if (!here?.reading) return false
  const change = palaceBookmarkRename(palaceComposition(here.reading), ref, name)
  if (change.kind === 'refused') { say(`Not renamed: ${change.reason}.`); return false }
  commitBookmarks(change.composition, here.reading)
  say('Bookmark renamed.')
  return true
}

export function deleteBookmark(bookmark: PalaceBookmark): void {
  const here = inside()
  if (!here?.reading) return
  commitBookmarks(removeBookmark(palaceComposition(here.reading), bookmark.ref), here.reading)
  say(`Removed the bookmark ${palaceBookmarkLabel(bookmark)}.`)
}

// ── T15: the floor's free arrangement ─────────────────────────────────────

/** One gesture's released points, saved once with the presence composition (palaceInstrument.tsx:363 moveBoardPoints). Pure
 * presentation: nothing here reaches the regions, the plan or the kernel. */
export function moveRooms(points: Record<string, BoardPoint>): void {
  const here = inside()
  if (!here) return
  const keys = roomsNow(here).map(room => room.key)
  let next = here.held
  for (const [key, point] of Object.entries(points)) next = moveBoardRegion(next, keys, key, snapBoardPoint(point, here.snap))
  if (next === here.held) return
  patch({held: next})
  if (here.reading) persist({...palaceComposition(here.reading), board: next}, here.reading)
}

/** A click or marquee selection on the floor hands its rooms to the plate's room list, and says so once (palaceInstrument.tsx:387). */
export function selectRooms(keys: readonly string[]): void {
  const here = inside()
  if (!here) return
  const rooms = roomsNow(here)
  const picked = rooms.filter(room => keys.includes(room.key))
  patch({selected: picked.map(room => room.key)})
  say(boardSelectionLine(picked.map(room => room.name)))
}

export function setSnap(snap: boolean): void {
  patch({snap})
}

/** Presentation of the floor (the mockup's Path and Guide, world-shell-mockup.html:1408): nothing persists, nothing is written. */
export function setPath(path: 'guided' | 'free'): void {
  patch({path})
}

export function setGuide(guide: boolean): void {
  patch({guide})
}

/** T15: the floor's pan and zoom. A pan or zoom fires per frame, so the save trails the last report (palaceInstrument.tsx:372). */
export const VIEWPORT_SETTLE_MS = 400
let viewportTimer: ReturnType<typeof setTimeout> | null = null
let viewportPending: PalaceBoardViewport | null = null

export function setViewport(viewport: PalaceBoardViewport): void {
  patch({viewport})
  viewportPending = viewport
  if (viewportTimer !== null) clearTimeout(viewportTimer)
  viewportTimer = setTimeout(flushViewport, VIEWPORT_SETTLE_MS)
}

function flushViewport(): void {
  if (viewportTimer !== null) { clearTimeout(viewportTimer); viewportTimer = null }
  const viewport = viewportPending, here = inside()
  viewportPending = null
  if (!viewport || !here?.reading) return
  persist({...palaceComposition(here.reading), viewport}, here.reading)
}

// ── T20: the composition, saved to the kernel Expression ──────────────────

/** A region holds exactly one Expression; adding past one is refused and a new region offered (palaceInstrument.tsx:318 addTo). */
export function addTo(regionName: string, expressionRef: string, title: string): void {
  const here = inside()
  if (!here) return
  const target = here.regions.find(region => region.name === regionName)
  if (target?.member) { say(`"${regionName}" already holds one Expression. A region holds one Expression; add another region for more.`); return }
  patch({regions: here.regions.map(region => region.name === regionName ? {...region, member: {expression_ref: expressionRef, title}} : region)})
}

/** A new region holding one Expression, named by it (palaceInstrument.tsx:326 addAsNewRegion). */
export function addAsNewRegion(expressionRef: string, title: string): void {
  const here = inside()
  if (!here) return
  const name = title || expressionRef
  let candidate = name, suffix = 2
  while (here.regions.some(region => region.name === candidate)) candidate = `${name} ${suffix++}`
  patch({regions: [...here.regions, {name: candidate, scene_ref: regionSceneRef(here.doc.expression_ref, candidate), member: {expression_ref: expressionRef, title}}]})
}

/** An empty region (palaceInstrument.tsx:343 addRegion). A blank or repeated name adds nothing. */
export function addRegion(name: string): boolean {
  const here = inside(), trimmed = name.trim()
  if (!here || !trimmed || here.regions.some(region => region.name === trimmed)) return false
  patch({regions: [...here.regions, {name: trimmed, scene_ref: regionSceneRef(here.doc.expression_ref, trimmed), member: null}]})
  return true
}

export function removeMember(regionName: string): void {
  const here = inside()
  if (here) patch({regions: here.regions.map(region => region.name === regionName ? {...region, member: null} : region)})
}

/** Move a region along the guided path (palaceInstrument.tsx:335 moveRegion). */
export function moveRegion(name: string, delta: number): void {
  const here = inside()
  if (!here) return
  const index = here.regions.findIndex(region => region.name === name), target = index + delta
  if (index < 0 || target < 0 || target >= here.regions.length) return
  const next = [...here.regions];
  [next[index], next[target]] = [next[target], next[index]]
  patch({regions: next})
}

/** Removal is staged and EXPLICIT: only a removed name earns a `scene_remove` on Save (palaceInstrument.tsx:353 removeRegion). */
export function removeRegion(name: string): void {
  const here = inside()
  if (!here) return
  const key = here.regions.find(region => region.name === name)?.scene_ref ?? regionSceneRef(here.doc.expression_ref, name)
  patch({regions: here.regions.filter(region => region.name !== name), removed: here.removed.includes(name) ? here.removed : [...here.removed, name],
    held: forgetBoardRegion(here.held, key), selected: here.selected.filter(selected => selected !== key)})
}

/** Revert takes the owner's current composition (palaceInstrument.tsx:417 cancel). */
export function revert(): void {
  const here = inside()
  if (!here) return
  patch({draftDoc: here.doc, regions: discoverRegions(here.doc), removed: []})
  say('Cancelled — no mutation.')
}

/** One Save, one CAS-gated edit diffed against the document the draft began at; replay emits nothing; the readback is checked
 * (palaceInstrument.tsx:425 save; app.ts:2737 composeExpression). */
export async function save(): Promise<void> {
  const here = inside()
  if (!here || here.busy || !owners) return
  const guard = generation
  const proposed = here.regions.map(region => ({...region, member: region.member ? {...region.member} : null}))
  let changes: ReturnType<typeof planRegions>
  try { changes = planRegions(here.draftDoc, proposed, [...here.removed]) } catch (error) { say(messageOf(error)); return }
  if (!changes) { say('Nothing to save — the composition already matches the native document.'); return }
  patch({busy: true})
  try {
    const result = palaceComposeReply(await owners.edit(palaceEditRequest(here.draftDoc.expression_ref, here.draftDoc.revision, changes)))
    if (guard !== generation) return
    if (!result.ok) { say(`Not saved: ${result.reason}`); return }
    if (result.document.expression_ref !== here.draftDoc.expression_ref || !Number.isSafeInteger(result.document.revision) || result.document.revision <= here.draftDoc.revision) {
      say('The Palace owner returned another source or an invalid revision. Your original draft is retained.')
      return
    }
    const readback = discoverRegions(result.document)
    if (!samePalaceComposition(proposed, readback)) {
      say(`The owner returned revision ${result.document.revision}, but its regions or guided order differ. Your draft is retained; leave and enter again to inspect the native result.`)
      return
    }
    await standAt(result.document, readback, guard)
    say(`Composition saved — revision ${result.document.revision}; readback confirms the regions and guided order.`, guard)
  } catch (error) {
    say(messageOf(error), guard)
  } finally {
    patch({busy: false}, guard)
  }
}

/** After a Save the palace stands at the owner's new revision: its rooms read again, and its whole re-read at the new basis. */
async function standAt(document: PalaceDocument, regions: readonly RegionDraft[], guard: number): Promise<void> {
  const here = inside()
  if (!here || !owners) return
  const raw = await owners.inspect(document.expression_ref)
  if (guard !== generation) return
  const doc = palaceSnapshot(raw)
  const basis = palaceBasisOf(doc, here.basis.scene_ref)
  patch({doc, draftDoc: doc, basis, savedRooms: roomsOf(raw as Parameters<typeof roomsOf>[0], owners.projection(here.palace.key)), regions: [...regions], removed: [], reading: undefined}, guard)
  const whole = await readWhole(basis)
  patch({reading: whole.reading, readingReason: whole.reason}, guard)
}

// ── T19: the Return ───────────────────────────────────────────────────────

/** Propose the Return over a bound view of the composition (palaceInstrument.tsx:389). Pure: nothing is written. */
export function proposeReturn(): void {
  const here = inside()
  if (!here?.reading) return
  const next = palaceReturnProposal(here.reading, {...palaceComposition(here.reading), bound: true})
  patch({proposal: next, acceptance: null})
  say(next.refusal ? `Return not routed: ${next.refusal}. Nothing was changed.` : 'Return proposed, awaiting human acceptance. Nothing has been written.')
}

export function refuseReturn(): void {
  patch({proposal: null, acceptance: null})
  say('Return refused. Nothing was written.')
}

/** Accept: the proposal's own route goes to the owner through the kernel-expression channel's invoke_action; the owner re-reads the
 * reading the proposal came from and decides. Only an invoked receipt crosses back to M0′ (palaceInstrument.tsx:399 acceptReturn). */
export async function acceptReturn(): Promise<void> {
  const here = inside()
  if (!here?.proposal || !here.reading || here.accepting || !here.proposal.receipt?.routed || !owners) return
  const request = palaceAcceptRequest(here.proposal, {expression_ref: here.doc.expression_ref, revision: here.doc.revision, scene_ref: here.basis.scene_ref})
  if (!request) { patch({acceptance: {line: 'Not accepted: the proposal has no routed action to invoke.', accepted: false}}); return }
  const guard = generation, reading = here.reading, proposal = here.proposal
  patch({accepting: true})
  try {
    const raw = await owners.invoke(request as unknown as Record<string, unknown>)
    if (guard !== generation) return
    const outcome = palaceAcceptOutcome(reading, proposal, raw)
    patch({acceptance: {line: outcome.line, accepted: outcome.accepted}}, guard)
    // T24: an accepted Return's receipt is kept on this session, so the palace renders it when the visitor comes back to it.
    if (outcome.accepted) storeComposition({...palaceComposition(reading), receipt: outcome.line})
    if (outcome.crossing) returnToGround(outcome.line)
  } catch (error) {
    patch({acceptance: {line: `Not accepted: ${messageOf(error)}.`, accepted: false}}, guard)
  } finally {
    patch({accepting: false}, guard)
  }
}

/** The one return to the M0′ ground (palaceInstrument.tsx:238 returnToGround). In the shell the ground is the Earth: leaving the
 * palace is the return. A reading that discloses no ground keeps the visitor here, and says so. */
export function returnToGround(line: string | null = null): void {
  const here = inside()
  if (!here?.reading) return
  if (!returnGroundInstrument(here.reading)) { say('This reading does not disclose the M0′ ground as available, so the Palace has nothing to return to.'); return }
  leavePalace(line ?? `Returned from ${here.palace.title} to the Earth.`)
}

// ── T16, T24: opening an object through its owner ─────────────────────────

/** Record the Open's trail step on the session's one history; a session elsewhere says so (palaceInstrument.tsx:258, seam A). */
function trail(ref: string, opened: string): void {
  const here = inside()
  if (!here?.reading || !owners) { say(`${opened} Its trail step waits for the Palace's integral reading.`); return }
  try {
    palaceTrailStep(owners.session, here.reading, ref)
    say(`${opened} Its trail step is recorded on the session.`)
  } catch (error) {
    say(`${opened} Its trail step was not recorded: ${messageOf(error)}`)
  }
}

function opened(act: () => string): string | null {
  if (!owners) { say('The Earth is not open, so nothing can be opened from the palace.'); return null }
  try { return act() } catch (error) { say(`Refused: ${messageOf(error)}`); return null }
}

/** One entry of the integral whole, opened in its own instrument or refused by name (palaceInstrument.tsx:214 openWhole, :248). */
export function openEntry(entry: PalaceRegionEntry): void {
  const route = palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS)
  if (route.kind === 'refused') { say(`Refused: ${route.reason}.`); return }
  if (route.kind === 'source') { const words = opened(() => owners!.open.source(route.ref)); if (words) say(words); return }
  openObject(route.instrument, route.ref)
}

/** Seams A and B: an Expression opens natively and records its trail step; a Scene of this palace opens in the stage; any other wired
 * instrument opens through the instrument door with the ref as its subject. */
/** The 3:3 Expression reading's instrument: an Expression ref opens as the Expression itself (a Technē instrument id, not a mode). */
const EXPRESSION_INSTRUMENT: TechneInstrument = 'expressions'

export function openObject(instrument: TechneInstrument, ref: string): void {
  const here = inside()
  if (!here) return
  if (instrument === EXPRESSION_INSTRUMENT) {
    if (ref === here.doc.expression_ref) { say(`Refused: ${here.palace.title} is the palace you stand in — its rooms are its Scenes.`); return }
    const words = opened(() => owners!.open.expression(ref))
    if (words) trail(ref, words)
    return
  }
  const room = roomsNow(here).find(candidate => candidate.key === ref && candidate.saved)
  if (instrument === 'journey' && room) { openRoom(room.key); return }
  const words = opened(() => owners!.open.instrument(instrument, ref))
  if (words) say(words)
}

/** A room's Open: a hand-made region opens its one contained Expression (refused by name when empty, self or broken —
 * palaceInstrument.tsx:222 openBoardRegion); any other room opens its own Scene in the stage. */
export function openRoom(key: string): void {
  const here = inside()
  if (!here) return
  const room = roomsNow(here).find(candidate => candidate.key === key)
  if (!room) return
  if (room.kind === 'region') {
    const route = palaceRegionOpenRoute(room.name, room.holds ? {expression_ref: room.holds.expression_ref} : null, here.doc.expression_ref, liveRefs(here))
    if (route.kind === 'refused') { say(`Refused: ${route.reason}.`); return }
    openObject(EXPRESSION_INSTRUMENT, route.ref)
    return
  }
  if (!room.saved) { say(`Refused: ${room.name} is not saved yet, so it has no Scene to open.`); return }
  const words = opened(() => owners!.open.scene(here.palace, room))
  if (words) trail(room.key, words)
}

/** A subject a room holds opens in the Scene that carries it (the subject door). */
export function openMember(member: {subject_ref: string; title: string}): void {
  const words = opened(() => owners!.open.subject(member.subject_ref, member.title))
  if (words) say(words)
}

/** For the tests: forget everything (the session's compositions are the presence owner's, reset there). */
export function resetPalaceSession(): void {
  ++generation
  stopWalking()
  if (viewportTimer !== null) clearTimeout(viewportTimer)
  viewportTimer = null
  viewportPending = null
  persistFailed = false
  owners = null
  set({phase: 'outside'})
}
