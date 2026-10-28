// The DLW's grooves: QL frames and MEF lenses, taken out of a constellation (manual §10.3 The pool: "Drop a constellation onto the pool
// and its frame and its lenses stand there, the way a clip dropped on Live's pool gives up its groove"; §16.7: "A frame is the form of a
// whole and the roles round it (§17.4). A lens is one of Quaternal Logic's twelve ways of seeing, with its six sublenses (§17.11). Each
// reads a clip without changing it"; decision #709 "The pool").
//
// Where each comes from, read from its owner and never invented here:
//   - A constellation's frame is the form its author gave it in the wiki: the `aikit.constellation/v1` construction's `frame` (AIKit's
//     AuthoredFrame: shape_ref, contract_ref, roles with their QL addresses; desktop/cradle/src/knowledge/construction.ts NativeFrame).
//     A constellation no one gave a form has none ("Open roles are legitimate and are not fabricated members", AIKit
//     knowledge_construction.rs AuthoredFrame).
//   - Its lenses are the lenses its members stand in. A member stands at the sixfold position the wiki declares for it (its own
//     `position`, or the address of the role it holds), on the direct or the conjugate face; QL's lens Ln is position n's way of seeing,
//     and its night face Ln′ the conjugate's (`ql mef lenses`: L0…L5 by position, each with a day and a night face). Each lens stands as
//     QL's registry gives it, its six sublenses by their labels.
// A frame reads a clip by its roles (which hold a member, which stand open); a lens reads it through QL's refraction (`ql wiki refract`,
// built here as QL's WikiRefractionRequest and read back as its WikiReading). Pure.
import type {NativeConstruction, NativeFrame} from '../../../../../../desktop/cradle/src/knowledge/construction'
import {PARTICIPATION, CONSTRUCTION, validNativeFrame} from '../../../../../../desktop/cradle/src/knowledge/construction'
import type {Constellation} from '../../owners/constellations'

/** The constellation a groove was taken out of. */
export interface GrooveSource {
  readonly ref: string
  readonly title: string
  /** Its register: "central" or the project's name. */
  readonly register: string
}

export interface FrameGroove {
  readonly kind: 'frame'
  readonly id: string
  /** The form's name, as the Canvas's Form page names it (§17.4). */
  readonly name: string
  readonly frame: NativeFrame
  readonly from: GrooveSource
}

export interface Sublens {readonly label: string; readonly ref: string}
export interface LensGroove {
  readonly kind: 'lens'
  readonly id: string
  /** Its code and name, as QL's registry gives them ("L1 Causal"). */
  readonly name: string
  readonly code: string
  readonly lensRef: string
  readonly face: string
  readonly square: string
  /** Its six sublenses in position order: the lens's parameters (§16.7 Sublenses). */
  readonly sublenses: readonly Sublens[]
  readonly from: GrooveSource
}

export type Groove = FrameGroove | LensGroove

/** Where one member of a constellation stands: its position (null where the wiki declares none) and face. */
export interface Stand {
  readonly ref: string
  readonly position: number | null
  readonly conjugate: boolean
  /** Its participation in an authored constellation (the ref AIKit keeps its role on). */
  readonly participation?: string
  /** The role it holds now, in an authored constellation. */
  readonly role?: string | null
}

const PRIME = '′'
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** The forms of §17.4's table, by the grain AIKit's QL shape names (`ql:shape:<version>:constellation:<grain>`). */
const FORMS: Readonly<Record<string, string>> = {
  'threefold-123': 'Threefold 1–2–3', 'threefold-450': 'Threefold 4–5–0', 'fourfold-1234': 'Fourfold 1–2–3–4',
  'four-plus-one-ground': 'Fourfold and its ground', 'four-plus-one-synthesis': 'Fourfold and its synthesis', sixfold: 'Sixfold',
  twelvefold: 'Sixfold and its conjugate',
}

/** A role's QL address: its position and face. */
export function roleAddress(role: NativeFrame['roles'][number]): {position: number | null; conjugate: boolean} {
  const address = role.address as {position?: unknown; conjugate?: unknown; face?: unknown}
  return {position: typeof address.position === 'number' ? address.position : null, conjugate: address.conjugate === true || address.face === 'conjugate'}
}
const mark = (stand: {position: number | null; conjugate: boolean}) => (stand.position === null ? '?' : `${stand.position}${stand.conjugate ? PRIME : ''}`)

/** A frame's name: its form as §17.4 names it; a pair by its two positions. Pure. */
export function formName(frame: NativeFrame): string {
  const grain = frame.shape_ref.split(':').pop() ?? frame.shape_ref
  if (grain === 'twofold') return `Pair ${frame.roles.map(role => mark(roleAddress(role))).join('/')}`
  return FORMS[grain] ?? `Form ${grain}`
}

/** A frame groove's identity: its shape and the addresses of its roles (two pairs share a shape and differ by their roles). */
export const frameGrooveId = (frame: NativeFrame): string => `frame:${frame.shape_ref}@${frame.roles.map(role => mark(roleAddress(role))).join(',')}`
export const lensGrooveId = (lensRef: string): string => `lens:${lensRef}`

/** Where each member of an authored constellation stands: its own position, else the address of the role it holds. Pure. */
export function standsOfConstruction(construction: NativeConstruction): Stand[] {
  const roles = new Map((construction[CONSTRUCTION].frame?.roles ?? []).map(role => [role.role_ref, role]))
  return (construction.constellations[0]?.members ?? []).map(member => {
    const participation = member[PARTICIPATION]
    const role = participation.role_ref ? roles.get(participation.role_ref) : undefined
    const address = role ? roleAddress(role) : {position: null, conjugate: false}
    return {ref: member.ref, position: typeof member.position === 'number' ? member.position : address.position,
      conjugate: member.conjugate === true || address.conjugate, participation: participation.participation_ref, role: participation.role_ref ?? null}
  })
}

/** Where each member of a constellation stands, as the wiki's projection reads it (owners/constellations.ts). Pure. */
export const standsOfConstellation = (constellation: Constellation): Stand[] =>
  constellation.members.map(member => ({ref: member.ref, position: member.position, conjugate: false}))

/** The lens a stand is read through: position n's lens, its night face for the conjugate (`L1`, `L1'`). Pure. */
export const lensCode = (position: number, conjugate: boolean): string => `L${position}${conjugate ? "'" : ''}`

/** One of QL's registry entries as a lens groove (`ql mef lenses`: lensRef, code, name, face, square, sublenses by position). */
function lensOf(entry: unknown, from: GrooveSource): LensGroove | null {
  if (!rec(entry) || typeof entry.lensRef !== 'string' || typeof entry.code !== 'string' || typeof entry.name !== 'string') return null
  const given = Array.isArray(entry.sublenses) ? entry.sublenses : []
  const sublenses = given.filter(rec).filter(item => typeof item.label === 'string' && typeof item.sublensRef === 'string')
    .sort((a, b) => Number(a.position) - Number(b.position)).map(item => ({label: String(item.label), ref: String(item.sublensRef)}))
  return {kind: 'lens', id: lensGrooveId(entry.lensRef), name: `${entry.code.replace("'", PRIME)} ${entry.name}`, code: entry.code, lensRef: entry.lensRef,
    face: typeof entry.face === 'string' ? entry.face : '', square: typeof entry.square === 'string' ? entry.square : '', sublenses: sublenses.length === 6 ? sublenses : [], from}
}

/** What a constellation gives up to the pool: its frame, where its author gave it one, and the lenses its members stand in, each as QL's
 * registry gives it. `said` names what did not come out, and why. Pure. */
export function groovesOf(input: {from: GrooveSource; frame: NativeFrame | null | undefined; stands: readonly Stand[]; lenses: readonly unknown[]}): {grooves: Groove[]; said: string[]} {
  const grooves: Groove[] = []
  const said: string[] = []
  if (input.frame && validNativeFrame(input.frame)) grooves.push({kind: 'frame', id: frameGrooveId(input.frame), name: formName(input.frame), frame: input.frame, from: input.from})
  else said.push(`${input.from.title} has no frame of its own: no one has given it a form in the wiki.`)
  const codes = [...new Set(input.stands.filter(stand => stand.position !== null).sort((a, b) => a.position! - b.position! || Number(a.conjugate) - Number(b.conjugate))
    .map(stand => lensCode(stand.position!, stand.conjugate)))]
  if (!codes.length) said.push(`${input.from.title}'s members stand at no position, so no lens reads them.`)
  for (const code of codes) {
    const lens = lensOf(input.lenses.find(entry => rec(entry) && entry.code === code), input.from)
    if (lens) grooves.push(lens)
    else said.push(`Quaternal Logic's lens registry gives no ${code.replace("'", PRIME)}.`)
  }
  return {grooves, said}
}

// ---------------------------------------------------------------------------------------------------------------- reading a clip

export interface FrameReading {
  readonly roles: readonly {readonly label: string; readonly refs: readonly string[]}[]
  readonly filled: number
  readonly open: number
  /** Members that hold no role of the form. */
  readonly outside: number
  readonly words: string
}

/** A constellation read through a frame: each role of the form with the members that stand at its address, the roles left open, and
 * the members outside the form. Nothing is placed that the wiki does not place. Pure. */
export function frameReading(groove: FrameGroove, stands: readonly Stand[]): FrameReading {
  const roles = groove.frame.roles.map(role => {
    const address = roleAddress(role)
    return {label: role.label, refs: stands.filter(stand => stand.position !== null && stand.position === address.position && stand.conjugate === address.conjugate).map(stand => stand.ref)}
  })
  const placed = new Set(roles.flatMap(role => role.refs))
  const filled = roles.filter(role => role.refs.length).length, open = roles.length - filled, outside = stands.filter(stand => !placed.has(stand.ref)).length
  const words = `Read through ${groove.name}: ${filled} of ${roles.length} roles filled${open ? `, ${roles.filter(role => !role.refs.length).map(role => role.label).join(', ')} open` : ''}`
    + `${outside ? `; ${outside} member${outside === 1 ? '' : 's'} outside the form` : ''}.`
  return {roles, filled, open, outside, words}
}

export const REFRACTION = 'ql-mef/wiki-refraction/v1'

/** QL's WikiRefractionRequest for a constellation read through a lens, or one of its sublenses (QL-MEF crates/ql-wiki/src/refraction.rs
 * WikiRefractionRequest; `ql wiki refract -`, QL-MEF #350): the constellation is the target, named by its whole's ref, its members the
 * subjects at the positions and faces the wiki declares. Pure. */
export function refractionRequest(input: {constellation: Pick<Constellation, 'ref' | 'kind'>; stands: readonly Stand[]; lens: LensGroove; sublens: number | null;
  hash: string; frameRef?: string; revision?: number}): Record<string, unknown> {
  const sublens = input.sublens === null ? undefined : input.lens.sublenses[input.sublens]
  return {contract: REFRACTION, mode: 'required',
    target: {kind: input.constellation.kind === 'frame' ? 'frame' : 'space', target_ref: input.constellation.ref,
      ...(input.frameRef ? {target_frame_ref: input.frameRef} : {}), ...(input.revision ? {target_revision: input.revision} : {}),
      target_snapshot_hash: input.hash,
      subjects: input.stands.map(stand => ({subject_ref: stand.ref, ...(stand.position === null ? {} : {position: stand.position, face: stand.conjugate ? 'conjugate' : 'direct'})}))},
    lenses: [{lens_ref: input.lens.lensRef, ...(sublens ? {sublens_ref: sublens.ref} : {})}]}
}

/** The snapshot a refraction names its target by: a digest of what QL is asked to read (the ref, its revision and its subjects). */
export async function snapshotHash(parts: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export interface LensReading {
  readonly words: string
  readonly readingRef: string
  readonly lensRef: string
  readonly sublensRef: string | null
  readonly resultClass: string
  readonly explanation: string
}

/** QL's answer to a refraction, read: its reading's disclosure, or why there is none in QL's words. Pure. */
export function lensReadingOf(answer: unknown): {ok: true; reading: LensReading} | {ok: false; why: string} {
  if (!rec(answer) || answer.contract !== REFRACTION) return {ok: false, why: 'Quaternal Logic answered something other than a refraction.'}
  const reading = Array.isArray(answer.readings) ? answer.readings.find(rec) : undefined
  const notices = Array.isArray(answer.notices) ? answer.notices.map(notice => (rec(notice) ? String(notice.message ?? notice.code ?? '') : String(notice))).filter(Boolean) : []
  if (!reading || typeof reading.disclosure !== 'string') return {ok: false, why: `Quaternal Logic gave no reading (${String(answer.status ?? 'no status')})${notices.length ? `: ${notices.join('; ')}` : '.'}`}
  return {ok: true, reading: {words: reading.disclosure, readingRef: String(reading.reading_ref ?? ''), lensRef: String(reading.lens_ref ?? ''),
    sublensRef: typeof reading.sublens_ref === 'string' ? reading.sublens_ref : null, resultClass: String(reading.result_class ?? ''),
    explanation: typeof reading.explanation === 'string' ? reading.explanation : ''}}
}

// ---------------------------------------------------------------------------------------------------------------- Commit

/** The changes that write a constellation's reading through a frame into the wiki (AIKit `aikit.constellation-action/v1`): the frame set
 * on the constellation, and each member set on the role at the address where it stands, or on none where the form has no role there
 * (AIKit refuses a membership role outside the authored frame). A member with no declared position holds no role. Pure. */
export function frameCommitChanges(groove: FrameGroove, construction: NativeConstruction): Record<string, unknown>[] {
  const changes: Record<string, unknown>[] = [{change: 'frame_set', frame: groove.frame}]
  for (const stand of standsOfConstruction(construction)) {
    const role = stand.position === null ? undefined
      : groove.frame.roles.find(item => { const address = roleAddress(item); return address.position === stand.position && address.conjugate === stand.conjugate })
    const next = role?.role_ref ?? null
    if (next !== (stand.role ?? null)) changes.push({change: 'role_set', participation_ref: stand.participation, role_ref: next})
  }
  return changes
}
