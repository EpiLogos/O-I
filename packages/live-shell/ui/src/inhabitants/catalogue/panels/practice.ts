// Carried practice, as AIKit reads it (ai-kit docs/PRAXIS-ARCHITECTURE.md §2–§4): one Skill identity in three forms — a Skill
// (what can I do?), a Method (`METHOD:`, how do I act?), a Methodology (`METHODOLOGY:`, how do I orient?) — carried in
// SkillSets (what repertoire do I carry?), which may hold child sets. Membership grants no trust, authority or loading; each
// member's involvement is a ladder of evidence, every rung yes, no or not observed. The fixture is Central's own
// `central:documentation` set (Work/Central/skillsets/documentation/members), its forms read from each SKILL.md.
import type {WoodKind, WoodState} from '../../sdk/icons'

export type Form = 'methodology' | 'method' | 'skill' | 'skillset'
export type Rung = boolean | null
export const RUNGS = ['carried', 'catalogued', 'available', 'selected', 'projected', 'loaded', 'invoked', 'relied on', 'succeeded', 'verified'] as const

export interface Member {
  readonly id: string
  readonly name: string
  readonly form: Form
  readonly rev: string
  readonly says: string
  /** The involvement ladder, carried → verified. */
  readonly rungs: readonly Rung[]
  /** Why AIKit holds it back, when it does; `fix` when the reason is one you can clear yourself (an unreviewed revision). */
  readonly withheld?: {readonly why: string; readonly fix?: 'review'}
  /** For a child set: how many members it carries. */
  readonly holds?: number
}

const L = (...r: (0 | 1 | null)[]): Rung[] => r.map(x => (x === null ? null : x === 1))
// Carried, catalogued, available, projected: the standing every admitted member reaches; loaded and invoked only with evidence.
const ready = L(1, 1, 1, 0, 1, null, null, null, null, null)

export const DOCUMENTATION: readonly Member[] = [
  {id: 'docs-methodology', name: 'docs-methodology', form: 'methodology', rev: 'r9', rungs: L(1, 1, 1, 1, 1, 1, null, null, null, null),
    says: "Orient in a project's documentation field: which kinds of document exist, what standing each claim carries, which documentation Method fits the act, and where Return goes."},
  {id: 'documentation-reconciliation', name: 'documentation-reconciliation', form: 'method', rev: 'r6', rungs: L(1, 1, 1, 1, 1, 1, 1, null, null, null),
    says: 'After a source or evidence change, find the documents that depend on it, revise them, reconcile the matrix and Wiki, verify and Return.'},
  {id: 'product-development', name: 'product-development', form: 'method', rev: 'r5', rungs: ready, says: 'Carry new product meaning from authored ground through Vision and Design to Mockup and code.'},
  {id: 'ui-development', name: 'ui-development', form: 'method', rev: 'r4', rungs: ready, says: 'Develop an experienced surface from its Vision through Design and Mockup to implementation.'},
  {id: 'architecture-development', name: 'architecture-development', form: 'method', rev: 'r3', rungs: ready, says: 'Develop structure: contracts, ownership, boundaries, invariants.'},
  {id: 'evidence-led-repair', name: 'evidence-led-repair', form: 'method', rev: 'r3', rungs: ready, says: 'Start from evidence that contradicts a documented determination and repair the nearest layer it touches.'},
  {id: 'reverse-recovery', name: 'reverse-recovery', form: 'method', rev: 'r4', rungs: L(1, 1, 0, 0, 0, null, null, null, null, null),
    withheld: {why: 'Revision r4 is unseen: nobody has reviewed it since it changed.', fix: 'review'},
    says: 'Recover a missing or thin documentation field from fragments, history, implementation and the owner.'},
  {id: 'experimental-development', name: 'experimental-development', form: 'method', rev: 'r2', rungs: L(1, 1, 0, 0, 0, null, null, null, null, null),
    withheld: {why: 'Turned off in the profile in use.'}, says: 'Answer a bounded product question by building a prototype first.'},
  {id: 'verification', name: 'verification', form: 'method', rev: 'r8', rungs: ready, says: 'Use before you claim an operation or an experience complete.'},
  {id: 'vision-authoring', name: 'vision-authoring', form: 'skill', rev: 'r7', rungs: L(1, 1, 1, 0, 1, 1, 1, 1, null, null), says: 'Write or revise a product Vision as a standalone account.'},
  {id: 'design-authoring', name: 'design-authoring', form: 'skill', rev: 'r6', rungs: ready, says: 'Write or revise a Design document: experience, behaviour, interaction.'},
  {id: 'ui-mockup-authoring', name: 'ui-mockup-authoring', form: 'skill', rev: 'r5', rungs: ready, says: 'Build a standalone mockup of a product surface, every state included.'},
  {id: 'architecture-authoring', name: 'architecture-authoring', form: 'skill', rev: 'r4', rungs: ready, says: 'Write or revise an Architecture document: contracts, ownership, boundaries.'},
  {id: 'diagram-authoring', name: 'diagram-authoring', form: 'skill', rev: 'r3', rungs: ready, says: 'Write a diagram that answers one visual question for a companion document.'},
  {id: 'documentation-standing', name: 'documentation-standing', form: 'skill', rev: 'r5', rungs: ready, says: 'Recover, compare and audit documentation through its authored positions.'},
  {id: 'capability-matrices', name: 'capability-matrices', form: 'skill', rev: 'r6', rungs: L(1, 1, 1, 0, 1, 1, null, null, null, null), says: 'Author and reconcile capability matrices beside the product accounts.'},
  {id: 'knowledge-navigation', name: 'knowledge-navigation', form: 'skill', rev: 'r4', rungs: ready, says: 'The first route for any question about what this project knows or decided.'},
  {id: 'projection-authoring', name: 'projection-authoring', form: 'skill', rev: 'r2', rungs: ready, says: 'Select, review and ratify an authored world reading.'},
  {id: 'aikit:account-authoring', name: 'account-authoring', form: 'skillset', rev: 'r3', holds: 3, rungs: ready, says: 'Carried by reference: product understanding, structured accounts, HTML accounts.'},
]

export const ORDER: readonly Form[] = ['methodology', 'method', 'skill', 'skillset']
export const FORM_NAME: Record<Form, string> = {methodology: 'Methodology', method: 'Method', skill: 'Skill', skillset: 'Set'}
export const FORM_ASKS: Record<Form, string> = {methodology: 'How do I orient?', method: 'How do I act?', skill: 'What can I do?', skillset: 'What do I carry?'}

/** The mark's state (the icon specimen's three): whole when available, warn when held back for a reason you can clear,
 * outline when withheld. */
export function markState(member: Member, requested = true): WoodState {
  if (!requested) return 'outline'
  if (member.withheld) return member.withheld.fix ? 'warn' : 'outline'
  return member.rungs[2] ? 'whole' : 'outline'
}
export const woodKind = (form: Form): WoodKind => form

/** How many members reach a rung. */
export const reaching = (members: readonly Member[], rung: number) => members.filter(m => m.rungs[rung] === true).length
