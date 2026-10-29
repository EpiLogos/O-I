// The Canvas's Form page (manual §17.4 "Give the board a form"; techne:canvas, page Form) on its owners (O-I #742, the construction chain:
// AIKit construction -> QL-MEF structure and geometry -> the Expression binding -> visible, selectable composition -> native save and read-back):
// the constellation you focus in the browser stands on the Form page as its whole and the cards round it on their roles, and every act is
// an owner's, through the kernel's routes (desktop/cradle/kernel/src/owner_routes.rs):
//
// - The composition is the owner's reading (owners/constellations.ts: the wiki's whole and its members, each at the position and face the
//   wiki declares), and where AIKit declares a frame round the whole its roles are the frame's (`wiki-shape validate`, read on focus; the
//   browser lists a frame round a space's whole as that whole on the frame's roles). A member at position n is on role n; a member on the
//   prime face is on n′.
//   The cards are the whole and its members, by their native refs, laid round the whole at their roles (the manual's "Layout moves no
//   source").
// - Form, Centre, Roles, Layout and Role are the view's own (presentation until Declare): held here, never sent to an owner.
// - Check: where the roles are what the wiki declares, AIKit's floor over the file (`validate`). A draft is QL-MEF's shape binding of it
//   (`ql shape bind`: the canonical shape the members disclose, its `ql-mef/shape-binding/v1` view and each same-position generated
//   relation) put into the frame body Declare would write, then AIKit's dry run of that body (`validate --stdin`, nothing written; with
//   the revision it read when the frame exists). Every member must be a thing the wiki holds.
// - Declare writes only a form the owner checked: the same body through `wiki-shape declare` (a new frame), or on the frame's revision
//   (`--expected-revision`, the change of roles on a frame your wiki holds; a stale revision is refused), then the register read again and
//   the owner's reading of it: it stands "In your wiki" when AIKit reads back the roles the Form shows. Then QL reads it.
// - Fold is the owner's `compress` of the whole: the twelve folded into one through the generated relations the shape binding carries;
//   its refusal is held in its words.
// - QL reads the declared whole (`ql techne reading`) over the Wiki's own projection of it (`wiki-shape target`), on focus and after
//   each Declare: its shape, members, lens and the instruments it stands on stand on the page.
// - Suggest stays the Decision helper's (no kernel route here; frameBindings.ts names it).
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {Constellation} from '../../owners/constellations'
import {CANVAS_DESIGN} from './designDevices'

/** The Form page's keys this binding carries over the Canvas's own. */
export const FORM_LOCAL = ['form', 'whole', 'roles', 'layout', 'role'] as const
export const FORM_ACTS = ['checkAsk', 'declare', 'fold', 'readAsk'] as const
export const FORM_READINGS = ['check', 'checkWhy', 'declared', 'declaredWhy', 'folded', 'foldWhy', 'reading', 'readingWhy'] as const
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

/** The focused constellation as the Form's composition: its whole, each member on its role, and the cards laid round the whole. With
 * `owned`, the roles are those the owner declares round the whole (a member it places no longer stands unplaced). Pure. */
export function compositionOf(constellation: Pick<Constellation, 'ref' | 'title' | 'members'>, owned?: Readonly<Record<string, string>>): Composition {
  const roles: Record<string, string> = {}
  const unplaced: string[] = []
  if (owned) {
    Object.assign(roles, owned)
    const placed = new Set(Object.values(owned))
    for (const member of constellation.members) if (!placed.has(member.ref)) unplaced.push(member.ref)
  } else for (const member of constellation.members) {
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

// ---------------------------------------------------------------------------------------------------------------- the owner's readings

/** The owner's reading of one declared constellation, as `aikit wiki-shape validate` gives it. */
export interface DeclaredReading {
  readonly frame: string
  readonly revision: number | null
  readonly anchor: string
  readonly grain: string | null
  readonly members: readonly {readonly ref: string; readonly position: number; readonly conjugate: boolean; readonly stance?: unknown}[]
  readonly returns: readonly unknown[]
}
export interface ValidateReading {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly declared: readonly DeclaredReading[]
  /** A draft's check (`validate --stdin`): what it would do and the revision it would stand at. */
  readonly draft?: {readonly ref: string | null; readonly would: 'create' | 'update'; readonly revision: number | null}
}

const errorText = (error: unknown): string => {
  if (typeof error === 'string') return error
  const row = error as {error?: unknown} | null
  return typeof row?.error === 'string' ? row.error : JSON.stringify(error)
}

/** `aikit wiki-shape validate`'s answer (its JSON envelope's data), as the readings of each declared constellation. Throws on a shape it
 * does not give. Pure. */
export function validateReadingOf(data: unknown): ValidateReading {
  const value = data as {command?: unknown; valid?: unknown; errors?: unknown; frames?: unknown; draft?: unknown}
  if (!value || value.command !== 'wiki-shape.validate' || !Array.isArray(value.frames)) throw Error('The Wiki owner returned no wiki-shape validation.')
  const errors = Array.isArray(value.errors) ? value.errors.map(errorText) : []
  const declared: DeclaredReading[] = []
  for (const frame of value.frames as {frame?: unknown; revision?: unknown; constellations?: unknown}[]) {
    if (typeof frame?.frame !== 'string' || !Array.isArray(frame.constellations)) continue
    const revision = Number.isInteger(frame.revision) ? frame.revision as number : null
    for (const row of frame.constellations as {anchor?: unknown; grain?: unknown; members?: unknown; returns?: unknown}[]) {
      if (typeof row?.anchor !== 'string') continue
      const members = (Array.isArray(row.members) ? row.members : []).flatMap((member: {ref?: unknown; position?: unknown; conjugate?: unknown; stance?: unknown}) =>
        typeof member?.ref === 'string' && Number.isInteger(member.position) ? [{ref: member.ref, position: member.position as number, conjugate: member.conjugate === true, stance: member.stance}] : [])
      declared.push({frame: frame.frame, revision, anchor: row.anchor, grain: typeof row.grain === 'string' ? row.grain : null, members,
        returns: Array.isArray(row.returns) ? row.returns : []})
    }
  }
  const d = value.draft as {ref?: unknown; would?: unknown; revision?: unknown} | undefined
  const draft = d && typeof d === 'object' ? {ref: typeof d.ref === 'string' ? d.ref : null, would: d.would === 'update' ? 'update' as const : 'create' as const,
    revision: Number.isInteger(d.revision) ? d.revision as number : null} : undefined
  return {valid: value.valid === true, errors, declared, ...(draft ? {draft} : {})}
}

/** The roles an owner's reading declares. Pure. */
export function rolesOfDeclared(reading: Pick<DeclaredReading, 'members'>): Record<string, string> {
  return Object.fromEntries(reading.members.map(member => [`${member.position}${member.conjugate ? '′' : ''}`, member.ref]))
}

const sameRoles = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([role, ref]) => b[role] === ref)

/** QL-MEF's shape binding of a drafted constellation, as `ql shape bind` gives it (`ql.shape-bind/v1`). */
export interface ShapeBound {
  readonly grain: string
  readonly shapeRef: string
  /** QL's `ql-mef/shape-binding/v1` view, kept on the constellation for QL to read again. */
  readonly binding: unknown
  /** Position -> the generated relation's identity, for every site both faces fill. */
  readonly generated: Readonly<Record<string, string>>
}
/** `ql shape bind`'s answer. Throws on a shape it does not give. Pure. */
export function shapeBoundOf(data: unknown): ShapeBound {
  const value = data as {schema?: unknown; grain?: unknown; shape_ref?: unknown; binding?: unknown; generated?: unknown} | null
  if (!value || value.schema !== 'ql.shape-bind/v1' || typeof value.grain !== 'string' || typeof value.shape_ref !== 'string' || !value.binding)
    throw Error('QL-MEF returned no shape binding.')
  const generated = value.generated && typeof value.generated === 'object' ? Object.fromEntries(Object.entries(value.generated as Record<string, unknown>)
    .filter(([, ref]) => typeof ref === 'string')) as Record<string, string> : {}
  return {grain: value.grain, shapeRef: value.shape_ref, binding: value.binding, generated}
}

/** The frame a Form declares round a whole that has none yet. */
export const frameRefOf = (whole: string): string => `wiki:frame:form:${whole}`
const PROVENANCE = {caller_ref: 'oi:techne:canvas:form', standing_ref: 'proposed'} as const

/** What QL is asked to bind: the frame, its whole and each card on its role (n direct, n′ conjugate). Pure. */
export function bindRequestOf(frameRef: string, whole: string, roles: Readonly<Record<string, string>>) {
  return {subject_ref: frameRef, whole_ref: whole, provenance: {...PROVENANCE, source_ref: whole},
    members: Object.entries(roles).map(([role, ref]) => ({subject_ref: ref, position: parseInt(role, 10), face: role.endsWith('′') ? 'conjugate' : 'direct'}))}
}

/** The frame body AIKit's `wiki-shape declare` takes for the form: one constellation round the whole, each card on its role, its shape
 * declaration (`aikit.ql-shape/v1`: QL's shape_ref, grain and generated relations, what `compress` folds) and QL's own binding view, and
 * the returns the owner already reads round it kept. Pure. */
export function frameBodyOf(frameRef: string, whole: string, title: string, roles: Readonly<Record<string, string>>, bound: ShapeBound,
  returns: readonly unknown[] = []) {
  const members = Object.entries(roles).map(([role, ref]) => ({ref, position: parseInt(role, 10), conjugate: role.endsWith('′')}))
  return {profile: 'okf-wiki/v1', object: 'frame', ref: frameRef, revision: 1, provenance: [], title, space_refs: [],
    member_refs: [whole, ...members.map(member => member.ref)], external_refs: [],
    constellations: [{anchor_ref: whole, members, returns,
      'aikit.ql-shape/v1': {shape_ref: bound.shapeRef, grain: bound.grain, generated: bound.generated},
      'ql-mef/shape-binding/v1': bound.binding}]}
}

/** What the Form page asks of the owners: the Wiki owner's shape commands over the register's wiki file, QL-MEF's shape binding and its
 * Technē reading. */
export interface FormOwners {
  validate(file: string): Promise<unknown>
  /** AIKit's dry run of a frame body (nothing written); `expectedRevision` names the held frame it changes. */
  check(file: string, frame: unknown, expectedRevision: number | null): Promise<unknown>
  /** AIKit's `declare`: a new frame, or with `expectedRevision` the change of roles on the frame the file holds at that revision. */
  declare(file: string, frameRef: string, frame: unknown, expectedRevision: number | null): Promise<unknown>
  compress(file: string, anchorRef: string): Promise<unknown>
  /** QL-MEF's shape binding of a drafted constellation. */
  bind(request: unknown): Promise<unknown>
  /** The Wiki's projection of the constellation round `anchorRef` as QL's Technē target. */
  target(file: string, anchorRef: string): Promise<unknown>
  /** QL's Technē reading of a target. */
  reading(target: unknown): Promise<unknown>
  /** The register read again, so the browser and the Form read what the owner now holds. */
  reread(): Promise<void>
}

/** The focus the Form stands on: the constellation, and the register's wiki file the owner's commands take (Central-relative). */
export interface FormFocus {
  readonly constellation: Constellation
  readonly file: string
}

/** The frame the owner declares round the whole, as it last read it. */
export interface Owned {readonly frame: string; readonly revision: number | null; readonly grain: string | null; readonly roles: Readonly<Record<string, string>>; readonly returns: readonly unknown[]}
type Said = {readonly why: string; readonly roles: Readonly<Record<string, string>>}
/** What the owners last said, held for the focus it was said of. */
export interface FormState {
  readonly whole: string | null
  /** The owner's frame round the whole (null: it declares none), once read. */
  readonly owned?: Owned | null
  readonly check?: Said & {readonly result: 'passed' | 'refused'}
  readonly declared?: Said & {readonly result: 'saved' | 'held' | 'refused'}
  readonly folded?: Said & {readonly result: 'folded' | 'refused'}
  readonly reading?: {readonly result: 'read' | 'refused'; readonly why: string}
  readonly busy?: boolean
}
let state: FormState = {whole: null}
const listeners = new Set<() => void>()
const set = (next: FormState) => { state = next; for (const listener of [...listeners]) listener() }
export const formState = (): FormState => state
export function subscribeForm(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } }
/** For the tests. */
export function resetFormState(): void { set({whole: null}) }
const update = (whole: string, change: Partial<FormState>) => set({...(state.whole === whole ? state : {whole}), ...change, whole})

const NO_FOCUS = 'Select a constellation in the browser (Material › Constellations): the Form stands on its whole and the roles your wiki gives it.'
const CHECK_FIRST = 'Check the form first: Declare writes only a form the owner checked, on the roles it checked.'

/** The roles the Form shows: the hand's draft, else the composition's. */
const rolesNow = (composition: Composition, held: Readonly<Record<string, Value>>): Record<string, string> => {
  const draft = held.roles
  if (typeof draft === 'string' && draft) { try { return JSON.parse(draft) as Record<string, string> } catch { /* the composition's, below */ } }
  return {...composition.roles}
}

const ownedIn = (reading: ValidateReading, whole: string): Owned | null => {
  const row = reading.declared.find(declared => declared.anchor === whole)
  return row ? {frame: row.frame, revision: row.revision, grain: row.grain, roles: rolesOfDeclared(row), returns: row.returns} : null
}

/** Read what the owner declares round the focused whole (on focus): the Form's roles are then the frame's, and QL's reading of it stands
 * on the page. */
export async function readForm(focus: FormFocus, owners: FormOwners): Promise<void> {
  const whole = focus.constellation.ref
  let owned: Owned | null
  try { owned = ownedIn(validateReadingOf(await owners.validate(focus.file)), whole) } catch { return /* the acts read again and say why */ }
  update(whole, {owned})
  if (owned) update(whole, {reading: await read(focus, owners)})
}

/** QL's binding of the roles and the frame body it gives, round the whole. */
async function drafted(focus: FormFocus, roles: Readonly<Record<string, string>>, owned: Owned | null, owners: FormOwners) {
  const whole = focus.constellation.ref, frameRef = owned?.frame ?? frameRefOf(whole)
  let bound: ShapeBound
  try { bound = shapeBoundOf(await owners.bind(bindRequestOf(frameRef, whole, roles))) } catch (error) { throw Error(`QL-MEF binds no shape for these roles: ${said(error)}`) }
  return {frameRef, bound, body: frameBodyOf(frameRef, whole, focus.constellation.title, roles, bound, owned?.returns ?? [])}
}

/** Check: the owner's floor over what the wiki declares, or over the draft the roles make. */
async function check(focus: FormFocus, roles: Readonly<Record<string, string>>, owners: FormOwners): Promise<{said: NonNullable<FormState['check']>; owned: Owned | null}> {
  const title = focus.constellation.title
  const reading = validateReadingOf(await owners.validate(focus.file))
  const owned = ownedIn(reading, focus.constellation.ref)
  if (owned && sameRoles(owned.roles, roles)) {
    if (!reading.valid || reading.errors.length) return {owned, said: {result: 'refused', why: `The Wiki owner refuses the frame: ${reading.errors.join('; ') || 'it is not valid'}.`, roles}}
    return {owned, said: {result: 'passed', why: `AIKit reads ${owned.grain ?? 'the frame'} round ${title} in ${owned.frame}: each role once, every conjugate on a filled direct role.`, roles}}
  }
  let draft
  try { draft = await drafted(focus, roles, owned, owners) } catch (error) { return {owned, said: {result: 'refused', why: said(error), roles}} }
  const checked = validateReadingOf(await owners.check(focus.file, draft.body, owned?.revision ?? null))
  if (!checked.valid || checked.errors.length) return {owned, said: {result: 'refused', why: `The Wiki owner refuses the draft: ${checked.errors.join('; ') || 'it is not valid'}.`, roles}}
  const absent = checked.declared.flatMap(row => row.members).find(member => member.stance === 'not-held')
  if (absent) return {owned, said: {result: 'refused', why: `${absent.ref} is not a thing your wiki holds: every card on a role is a real thing.`, roles}}
  const grain = checked.declared[0]?.grain ?? draft.bound.grain
  const would = owned ? `change ${draft.frameRef} from revision ${owned.revision} to ${checked.draft?.revision ?? (owned.revision ?? 0) + 1}` : `write ${draft.frameRef}`
  return {owned, said: {result: 'passed', roles,
    why: `AIKit checks the draft: ${grain} round ${title}, each role once, every conjugate on a filled direct role; Declare would ${would}, its shape QL's ${draft.bound.shapeRef}.`}}
}

/** Declare: the checked form written through the owner (or, where the wiki already declares these roles, read back), then read back. */
async function declare(focus: FormFocus, roles: Readonly<Record<string, string>>, checked: boolean, owners: FormOwners): Promise<{said: NonNullable<FormState['declared']>; owned: Owned | null}> {
  const whole = focus.constellation.ref, title = focus.constellation.title, count = Object.keys(roles).length
  await owners.reread()
  const before = ownedIn(validateReadingOf(await owners.validate(focus.file)), whole)
  if (before && sameRoles(before.roles, roles)) {
    return {owned: before, said: {result: 'saved', roles, why: `${before.frame} stands in your wiki with these ${count} roles round ${title}: AIKit read it back (${before.grain ?? 'its frame'}).`}}
  }
  if (!checked) return {owned: before, said: {result: 'held', why: CHECK_FIRST, roles}}
  const draft = await drafted(focus, roles, before, owners)
  await owners.declare(focus.file, draft.frameRef, draft.body, before?.revision ?? null)
  await owners.reread()
  const after = ownedIn(validateReadingOf(await owners.validate(focus.file)), whole)
  if (!after || !sameRoles(after.roles, roles)) return {owned: after, said: {result: 'refused', roles, why: `AIKit wrote ${draft.frameRef}, but reads back other roles round ${title}.`}}
  return {owned: after, said: {result: 'saved', roles,
    why: `${after.frame} stands in your wiki at revision ${after.revision} with these ${count} roles round ${title}, its shape QL's ${draft.bound.shapeRef}: AIKit read it back.`}}
}

/** Fold: the owner's compression of the whole's twelve through the generated relations it declares. */
async function fold(focus: FormFocus, roles: Readonly<Record<string, string>>, owners: FormOwners): Promise<NonNullable<FormState['folded']>> {
  try {
    const folded = await owners.compress(focus.file, focus.constellation.ref) as {composites?: unknown; trinity?: {zero?: unknown; slash?: unknown; one?: unknown}} | null
    const composites = Array.isArray(folded?.composites) ? folded!.composites : []
    const t = folded?.trinity
    const trinity = t && typeof t.zero === 'string' ? `${t.zero} : ${t.slash} : ${t.one} = 0 : / : 1` : 'into one'
    return {result: 'folded', roles,
      why: `AIKit folds the twelve into one round ${focus.constellation.title}: ${composites.length} positions, each direct and conjugate married in its generated relation — ${trinity}.`}
  } catch (error) { return {result: 'refused', roles, why: said(error)} }
}

/** Read: QL's Technē reading of the declared whole, over the Wiki's own projection of it. */
async function read(focus: FormFocus, owners: FormOwners): Promise<NonNullable<FormState['reading']>> {
  try {
    const projected = await owners.target(focus.file, focus.constellation.ref) as {target?: unknown} | null
    if (!projected?.target) throw Error('The Wiki owner projected no target for QL.')
    const answer = await owners.reading(projected.target) as {contract?: unknown; reading?: {whole?: {whole_ref?: unknown; member_refs?: unknown} | null; ql?: {shape_ref?: unknown; lens_ref?: unknown} | null;
      disclosure?: {instruments?: unknown}}} | null
    if (answer?.contract !== 'ql.techne/v1' || !answer.reading) throw Error('QL returned no Technē reading.')
    const {whole, ql, disclosure} = answer.reading
    const members = Array.isArray(whole?.member_refs) ? whole!.member_refs.length : 0
    const on = (Array.isArray(disclosure?.instruments) ? disclosure!.instruments as {instrument?: unknown; available?: unknown}[] : [])
      .filter(row => row.available === true && typeof row.instrument === 'string').map(row => row.instrument as string)
    const shape = typeof ql?.shape_ref === 'string' ? ql.shape_ref : 'no shape'
    return {result: 'read', why: whole ? `QL reads ${shape} round ${String(whole.whole_ref)}: ${members} members through ${String(ql?.lens_ref ?? 'its lens')}; it stands on ${on.join(', ') || 'no instrument'}.`
      : `QL reads ${focus.constellation.title} with no bounded whole: its shape binding is not disclosed; it stands on ${on.join(', ') || 'no instrument'}.`}
  } catch (error) { return {result: 'refused', why: said(error)} }
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
  const mine = current.whole === focus.constellation.ref
  const owned = mine ? current.owned ?? null : null
  const composition = compositionOf(focus.constellation, owned?.roles)
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
  // Each reading holds for the roles it was said of: a role moved since stands it aside.
  const holds = (said: Said | undefined): said is Said => !!said && sameRoles(said.roles, roles)
  if (mine && holds(current.check)) { values.check = current.check!.result; values.checkWhy = current.check!.why }
  if (mine && holds(current.declared)) { values.declared = current.declared!.result; values.declaredWhy = current.declared!.why }
  else if (owned && sameRoles(owned.roles, roles)) { values.declared = 'saved'; values.declaredWhy = `${owned.frame} stands in your wiki at revision ${owned.revision} round ${focus.constellation.title}.` }
  else if (!owned && focus.constellation.kind === 'frame' && sameRoles(composition.roles, roles)) values.declared = 'saved'
  if (mine && holds(current.folded)) { values.folded = current.folded!.result; values.foldWhy = current.folded!.why }
  if (mine && current.reading) { values.reading = current.reading.result; values.readingWhy = current.reading.why }
  const standing: Record<string, Standing> = {...(canvas.standing ?? {})}
  for (const key of FORM_KEYS) delete standing[key]
  if (current.busy && mine) for (const key of FORM_ACTS) standing[key] = {disabled: 'The owners are still answering the last act.'}
  if (values.declared !== undefined && values.declared !== 'saved') standing.declared = {disabled: String(values.declaredWhy ?? '')}
  const local = {...(canvas.local ?? {}), ...Object.fromEntries(FORM_LOCAL.map(key => [key, hands[key]!] as const))}
  const run = async (key: string) => {
    const whole = focus.constellation.ref
    update(whole, {busy: true})
    try {
      if (key === 'checkAsk') { const out = await check(focus, roles, owners); update(whole, {busy: false, check: out.said, owned: out.owned}) }
      else if (key === 'declare') {
        const checked = state.whole === whole && state.check?.result === 'passed' && sameRoles(state.check.roles, roles)
        const out = await declare(focus, roles, checked, owners)
        update(whole, {busy: false, declared: out.said, owned: out.owned})
        if (out.said.result === 'saved') update(whole, {reading: await read(focus, owners)})
      } else if (key === 'fold') update(whole, {busy: false, folded: await fold(focus, roles, owners)})
      else update(whole, {busy: false, reading: await read(focus, owners)})
    } catch (error) {
      if (key === 'checkAsk') update(whole, {busy: false, check: {result: 'refused', why: said(error), roles}})
      else if (key === 'declare') update(whole, {busy: false, declared: {result: 'refused', why: said(error), roles}})
      else update(whole, {busy: false})
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
