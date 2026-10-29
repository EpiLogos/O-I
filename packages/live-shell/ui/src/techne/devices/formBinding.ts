// The Canvas's Form page (manual §17.4 "Give the board a form"; techne:canvas, page Form) on its owners (O-I #742, the construction chain's
// K2 link): the constellation you focus in the browser stands on the Form page as its whole and the cards round it on their roles, and
// Check, Declare and Fold are the Wiki owner's own (AIKit's `wiki-shape validate · declare · compress`, through the kernel's aikit routes,
// desktop/cradle/kernel/src/owner_routes.rs aikit_read_args / WikiShapeDeclare).
//
// - The composition is the owner's reading (owners/constellations.ts: the wiki's whole and its members, each at the position and face the
//   wiki declares). A member at position n is on role n; a member on the prime face is on n′. The cards are the whole and its members, by
//   their native refs, laid round the whole at their roles (presentation only: the manual's "Layout moves no source").
// - Form, Centre, Roles, Layout and Role are the view's own (presentation until Declare): held here, never sent to an owner.
// - Check asks the owner what your wiki declares round the whole (`validate` reads every frame the register's wiki file holds). It passes
//   when the owner reads the same roles, each once, with no error; a draft that differs from what the wiki declares is not the owner's
//   to check before it is written (no dry run is routed: missing op named).
// - Declare is the owner's: what your wiki declares round the whole is read back through `validate`, and stands "In your wiki" when it
//   holds the roles the Form shows. The owner's `declare` creates a frame and refuses one that exists ("Wiki object … already exists",
//   run 29 Oct through the kernel route), so a change of roles on a frame your wiki holds is AIKit's constellation apply (role_set on the
//   frame's revision) — not carried here yet, and named; a whole with no frame (a space) waits on its shape binding, which is QL's.
// - Fold is the owner's `compress` of the whole; its refusal comes back in its words.
// - Suggest stays the Decision helper's (no kernel route here; frameBindings.ts names it).
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {Constellation} from '../../owners/constellations'
import {CANVAS_DESIGN, missing} from './designDevices'

/** The Form page's keys this binding carries over the Canvas's own. */
export const FORM_LOCAL = ['form', 'whole', 'roles', 'layout', 'role'] as const
export const FORM_ACTS = ['checkAsk', 'declare', 'fold'] as const
export const FORM_READINGS = ['check', 'checkWhy', 'declared'] as const
const FORM_KEYS: readonly string[] = [...FORM_LOCAL, ...FORM_ACTS, ...FORM_READINGS]

/** The design's forms (techne__canvas.tsx FORMS, AIKit's catalogue ids by their roles) with the owner's grain each declares
 * (ai-kit knowledge_wiki_shape.rs WikiQlConstellationGrain). */
const SIX = ['0', '1', '2', '3', '4', '5']
export const FORM_GRAINS: readonly {form: string; grain: string; roles: readonly string[]}[] = [
  {form: 'threefold-123', grain: 'threefold-123', roles: ['1', '2', '3']},
  {form: 'threefold-450', grain: 'threefold-450', roles: ['4', '5', '0']},
  {form: 'fourfold', grain: 'fourfold-1234', roles: ['1', '2', '3', '4']},
  {form: 'fourfold-ground', grain: 'four-plus-one-ground', roles: ['0', '1', '2', '3', '4']},
  {form: 'fourfold-synthesis', grain: 'four-plus-one-synthesis', roles: ['1', '2', '3', '4', '5']},
  {form: 'sixfold', grain: 'sixfold', roles: SIX},
  {form: 'twelvefold', grain: 'twelvefold', roles: [...SIX, ...SIX.map(role => `${role}′`)]},
]

/** The role a member stands on: its position, primed on the prime face; none without a position. */
export function roleOfMember(member: Pick<Constellation['members'][number], 'position' | 'face'>): string | null {
  if (member.position === null || !Number.isInteger(member.position)) return null
  return `${member.position}${member.face === 'prime' ? '′' : ''}`
}

/** The smallest of the design's forms whose roles hold every role the composition fills; none when no form holds them. Pure. */
export function formOfRoles(roles: Readonly<Record<string, string>>): string | undefined {
  const filled = Object.keys(roles)
  if (!filled.length) return undefined
  return FORM_GRAINS.find(entry => filled.every(role => entry.roles.includes(role)))?.form
}

export interface FormCard {readonly id: string; readonly kind: 'card'; readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number}
export interface Composition {
  readonly whole: string
  readonly title: string
  readonly roles: Readonly<Record<string, string>>
  /** Members the wiki gathers at no position: on the board, on no role. */
  readonly unplaced: readonly string[]
  readonly cards: readonly FormCard[]
}

const CARD = {w: 160, h: 96}
/** A role's place round the whole: position × 60° from the top, clockwise; a conjugate further out (the design's placeOf, AIKit's catalogue
 * layout). */
const placeOf = (role: string) => { const n = parseInt(role, 10), a = n * Math.PI / 3 - Math.PI / 2, r = role.endsWith('′') ? 1.45 : 1; return {x: Math.cos(a) * r, y: Math.sin(a) * r} }

/** The focused constellation as the Form's composition: its whole, each member on its role, and the cards laid round the whole. Pure. */
export function compositionOf(constellation: Pick<Constellation, 'ref' | 'title' | 'members'>): Composition {
  const roles: Record<string, string> = {}
  const unplaced: string[] = []
  for (const member of constellation.members) {
    const role = roleOfMember(member)
    if (role === null || roles[role] !== undefined) unplaced.push(member.ref)
    else roles[role] = member.ref
  }
  const R = 3 * CARD.w
  const at = (id: string, name: string, x: number, y: number): FormCard => ({id, kind: 'card', name, x: Math.round(x - CARD.w / 2), y: Math.round(y - CARD.h / 2), ...CARD})
  const titleOf = (ref: string) => constellation.members.find(member => member.ref === ref)?.title ?? ref
  const cards: FormCard[] = [at(constellation.ref, constellation.title, 0, 0)]
  for (const [role, ref] of Object.entries(roles)) { const q = placeOf(role); cards.push(at(ref, titleOf(ref), q.x * R, q.y * R)) }
  unplaced.forEach((ref, i) => cards.push(at(ref, titleOf(ref), (i - (unplaced.length - 1) / 2) * (CARD.w + 24), 2.2 * R)))
  return {whole: constellation.ref, title: constellation.title, roles, unplaced, cards}
}

// ---------------------------------------------------------------------------------------------------------------- the owner's acts

/** The owner's reading of one declared constellation, as `aikit wiki-shape validate` gives it. */
export interface DeclaredReading {
  readonly frame: string
  readonly anchor: string
  readonly grain: string | null
  readonly members: readonly {readonly ref: string; readonly position: number; readonly conjugate: boolean}[]
}
export interface ValidateReading {readonly valid: boolean; readonly errors: readonly string[]; readonly declared: readonly DeclaredReading[]}

/** `aikit wiki-shape validate`'s answer (its JSON envelope's data), as the readings of each declared constellation. Throws on a shape it
 * does not give. Pure. */
export function validateReadingOf(data: unknown): ValidateReading {
  const value = data as {command?: unknown; valid?: unknown; errors?: unknown; frames?: unknown}
  if (!value || value.command !== 'wiki-shape.validate' || !Array.isArray(value.frames)) throw Error('The Wiki owner returned no wiki-shape validation.')
  const errors = Array.isArray(value.errors) ? value.errors.map(error => (typeof error === 'string' ? error : JSON.stringify(error))) : []
  const declared: DeclaredReading[] = []
  for (const frame of value.frames as {frame?: unknown; constellations?: unknown}[]) {
    if (typeof frame?.frame !== 'string' || !Array.isArray(frame.constellations)) continue
    for (const row of frame.constellations as {anchor?: unknown; grain?: unknown; members?: unknown}[]) {
      if (typeof row?.anchor !== 'string') continue
      const members = (Array.isArray(row.members) ? row.members : []).flatMap((member: {ref?: unknown; position?: unknown; conjugate?: unknown}) =>
        typeof member?.ref === 'string' && Number.isInteger(member.position) ? [{ref: member.ref, position: member.position as number, conjugate: member.conjugate === true}] : [])
      declared.push({frame: frame.frame, anchor: row.anchor, grain: typeof row.grain === 'string' ? row.grain : null, members})
    }
  }
  return {valid: value.valid === true, errors, declared}
}

/** The roles an owner's reading declares. Pure. */
export function rolesOfDeclared(reading: Pick<DeclaredReading, 'members'>): Record<string, string> {
  return Object.fromEntries(reading.members.map(member => [`${member.position}${member.conjugate ? '′' : ''}`, member.ref]))
}

const sameRoles = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([role, ref]) => b[role] === ref)

/** What the Form page asks of the owners: the Wiki owner's shape commands over the register's wiki file. */
export interface FormOwners {
  validate(file: string): Promise<unknown>
  compress(file: string, anchorRef: string): Promise<unknown>
  /** The register read again, so the browser and the Form read what the owner now holds. */
  reread(): Promise<void>
}

/** The focus the Form stands on: the constellation, and the register's wiki file the owner's commands take (Central-relative). */
export interface FormFocus {
  readonly constellation: Constellation
  readonly file: string
}

/** What the owners last said, held for the focus it was said of. */
export interface FormState {
  readonly whole: string | null
  readonly check?: {readonly result: 'passed' | 'refused'; readonly why: string; readonly roles: Readonly<Record<string, string>>}
  readonly declared?: {readonly result: 'saved' | 'held' | 'refused'; readonly why: string}
  readonly busy?: boolean
}
let state: FormState = {whole: null}
const listeners = new Set<() => void>()
const set = (next: FormState) => { state = next; for (const listener of [...listeners]) listener() }
export const formState = (): FormState => state
export function subscribeForm(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } }
/** For the tests. */
export function resetFormState(): void { set({whole: null}) }

const NO_FOCUS = 'Select a constellation in the browser (Material › Constellations): the Form stands on its whole and the roles your wiki gives it.'
const NO_DRAFT_CHECK = missing('Check of a draft', 'a dry run of aikit wiki-shape validate over a frame not yet written (validate reads the frames a wiki file holds)', 'AIKit')
const NO_SHAPE_BINDING = missing('Declare of a new frame', 'the shape binding a new frame declares (QL-MEF StructuralConstellation · ShapeBinding, its shape_ref and generated relations), checked before it is written — a whole with no frame has none yet', 'QL-MEF · AIKit')
const NO_ROLE_SET = missing('Declare of new roles on a frame your wiki holds', 'aikit.constellation.apply role_set on the frame\'s revision from this page (desktop/cradle/src/knowledge/construction.ts saveConstruction carries it for the detached construction panel); aikit wiki-shape declare creates frames and refuses one that exists', 'AIKit')

/** The roles the Form shows: the hand's draft, else the composition's. */
const rolesNow = (composition: Composition, held: Readonly<Record<string, Value>>): Record<string, string> => {
  const draft = held.roles
  if (typeof draft === 'string' && draft) { try { return JSON.parse(draft) as Record<string, string> } catch { /* the composition's, below */ } }
  return {...composition.roles}
}

/** Ask the owner to check what the wiki declares round the whole. */
async function check(focus: FormFocus, roles: Readonly<Record<string, string>>, owners: FormOwners): Promise<NonNullable<FormState['check']>> {
  const reading = validateReadingOf(await owners.validate(focus.file))
  const declared = reading.declared.find(row => row.anchor === focus.constellation.ref)
  if (!declared) return {result: 'refused', why: `Your wiki declares no frame round ${focus.constellation.title}: ${NO_SHAPE_BINDING}`, roles}
  const owned = rolesOfDeclared(declared)
  if (!sameRoles(owned, roles)) return {result: 'refused', why: `The roles differ from what your wiki declares round ${focus.constellation.title}. ${NO_DRAFT_CHECK}`, roles}
  if (!reading.valid || reading.errors.length) return {result: 'refused', why: `The Wiki owner refuses the frame: ${reading.errors.join('; ') || 'it is not valid'}.`, roles}
  return {result: 'passed', why: `AIKit reads ${declared.grain ?? 'the frame'} round ${focus.constellation.title} in ${declared.frame}: each role once, every conjugate on a filled direct role.`, roles}
}

/** Declare: what the wiki declares round the whole, read back from the owner; new roles and new frames name the operations they wait on. */
async function declare(focus: FormFocus, roles: Readonly<Record<string, string>>, owners: FormOwners): Promise<NonNullable<FormState['declared']>> {
  await owners.reread()
  const declared = validateReadingOf(await owners.validate(focus.file)).declared.find(row => row.anchor === focus.constellation.ref)
  if (!declared) return {result: 'refused', why: NO_SHAPE_BINDING}
  if (!sameRoles(rolesOfDeclared(declared), roles)) return {result: 'held', why: NO_ROLE_SET}
  return {result: 'saved', why: `${declared.frame} stands in your wiki with these ${Object.keys(roles).length} roles round ${focus.constellation.title}: AIKit read it back (${declared.grain ?? 'its frame'}).`}
}

const said = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The Form page carried over the Canvas's binding: its values from the focused constellation and the hand, its acts on the owners. */
export function canvasCarryingForm(canvas: DesignBinding, focus: FormFocus | null, held: Readonly<Record<string, Value>>,
  hands: Readonly<Record<string, (value: Value | undefined) => void>>, owners: FormOwners, current: FormState = state): DesignBinding {
  if (!focus) {
    // No constellation in focus: the Form stays as the Canvas binding leaves it, and its choosers say what it waits for.
    const standing: Record<string, Standing> = {...(canvas.standing ?? {})}
    for (const key of FORM_KEYS) if (!(key in canvas.values)) standing[key] = {disabled: NO_FOCUS}
    return {...canvas, standing}
  }
  const composition = compositionOf(focus.constellation)
  const roles = rolesNow(composition, held)
  const values = {...canvas.values}
  // The cards of the composition join the board's own items (the board's own stand first; a card already on the board is not repeated).
  let board: {id?: unknown}[] = []
  try { board = typeof values.items === 'string' ? JSON.parse(values.items) as {id?: unknown}[] : [] } catch { board = [] }
  values.items = JSON.stringify([...board, ...composition.cards.filter(card => !board.some(item => item.id === card.id))])
  values.whole = typeof held.whole === 'string' && held.whole ? held.whole : composition.whole
  values.roles = JSON.stringify(roles)
  const form = typeof held.form === 'string' ? held.form : formOfRoles(roles)
  if (form) values.form = form
  values.layout = typeof held.layout === 'string' ? held.layout : 'form'
  if (typeof held.role === 'string') values.role = held.role
  const mine = current.whole === focus.constellation.ref
  if (mine && current.check) {
    // A check holds for the roles it was asked of: a role moved since stands it aside.
    if (sameRoles(current.check.roles, roles)) { values.check = current.check.result; values.checkWhy = current.check.why }
  }
  if (mine && current.declared) values.declared = current.declared.result
  else if (focus.constellation.kind === 'frame' && sameRoles(composition.roles, roles)) values.declared = 'saved'
  const standing: Record<string, Standing> = {...(canvas.standing ?? {})}
  for (const key of FORM_KEYS) delete standing[key]
  if (current.busy && mine) for (const key of FORM_ACTS) standing[key] = {disabled: 'The Wiki owner is still answering the last act.'}
  if (mine && current.declared && current.declared.result !== 'saved') standing.declared = {disabled: current.declared.why}
  const local = {...(canvas.local ?? {}), ...Object.fromEntries(FORM_LOCAL.map(key => [key, hands[key]!] as const))}
  const run = async (key: string) => {
    const whole = focus.constellation.ref
    set({...(state.whole === whole ? state : {whole}), busy: true})
    try {
      if (key === 'checkAsk') set({...state, whole, busy: false, check: await check(focus, roles, owners)})
      else if (key === 'declare') set({...state, whole, busy: false, declared: await declare(focus, roles, owners)})
      else {
        await owners.compress(focus.file, whole)
        set({...state, whole, busy: false})
      }
    } catch (error) {
      if (key === 'checkAsk') set({...state, whole, busy: false, check: {result: 'refused', why: said(error), roles}})
      else if (key === 'declare') set({...state, whole, busy: false, declared: {result: 'refused', why: said(error)}})
      else { set({...state, whole, busy: false}); throw error }
    }
  }
  return {...canvas, id: CANVAS_DESIGN, values, standing, local,
    writes: key => ((FORM_ACTS as readonly string[]).includes(key) ? true : canvas.writes ? canvas.writes(key) : !!canvas.write),
    write: async (changes: readonly ValueChange[]) => {
      const acts = changes.filter(change => (FORM_ACTS as readonly string[]).includes(change.key))
      const own = changes.filter(change => !(FORM_ACTS as readonly string[]).includes(change.key))
      for (const change of acts) await run(change.key)
      if (own.length) {
        if (!canvas.write) throw new Error(`${own[0]!.key}: a reading — the frame reports it, and nothing here changes it.`)
        await canvas.write(own)
      }
    }}
}
