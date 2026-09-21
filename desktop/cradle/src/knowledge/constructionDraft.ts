import {ACTOR, CONSTRUCTION, PARTICIPATION, RELATION, editable, nativeFrame, newRef,
  type AuthoringForm, type ConstructionRequest, type NativeConstruction, type NativeFrame, type NativeMember, type NativeRelation} from './construction';
import {passageKey, passageProvenance, type WikiPassage} from './selection';

export interface DraftMember {
  subject_ref: string;
  participation_ref: string;
  role_ref: string | null;
  label: string;
  sources: Record<string, unknown>[];
  passage?: WikiPassage;
}
export interface DraftRelation {
  ref: string; revision?: number; from: string; to: string;
  relation: string; direction: string; standing: string; evidence: Record<string, unknown>[];
}
/** A revision-bound proposal over an existing native construction. This is
 * editor state; only a saved native Action result establishes knowledge. */
export interface ConstructionDraft {
  frame_ref: string; anchor_ref: string; basis?: NativeConstruction;
  original_relations: NativeRelation[]; title: string; question: string;
  space_ref: string; form: NativeFrame | null; members: DraftMember[]; relations: DraftRelation[];
}
export function emptyDraft(space_ref = ''): ConstructionDraft {
  return {frame_ref: newRef('wiki:frame'), anchor_ref: newRef('wiki:anchor'), original_relations: [],
    title: '', question: '', space_ref, form: null, members: [], relations: []};
}
export function memberDraft(member: NativeMember): DraftMember {
  const part = member[PARTICIPATION];
  return {subject_ref: member.ref, participation_ref: part.participation_ref, role_ref: part.role_ref ?? null,
    label: part.note || member.ref, sources: part.sources};
}
export function fromNative(frame: NativeConstruction, relations: NativeRelation[]): ConstructionDraft {
  editable(frame);
  const whole = frame.constellations[0], meta = frame[CONSTRUCTION];
  const members = whole.members.map(memberDraft), ids = new Set(members.map(member => member.participation_ref));
  const ours = relations.filter(edge => ids.has(edge[RELATION].from_participation_ref) && ids.has(edge[RELATION].to_participation_ref));
  return {frame_ref: frame.ref, anchor_ref: whole.anchor_ref, basis: frame, original_relations: ours,
    title: meta.title, question: meta.inquiry.question, space_ref: '', form: meta.frame ?? null, members,
    relations: ours.filter(edge => edge[RELATION].standing !== 'retracted').map(edge => ({ref: edge.ref, revision: edge.revision,
      from: edge[RELATION].from_participation_ref, to: edge[RELATION].to_participation_ref, relation: edge.relation,
      direction: edge[RELATION].direction, standing: edge[RELATION].standing, evidence: edge[RELATION].evidence ?? []}))};
}
export function withPassage(draft: ConstructionDraft, passage: WikiPassage): ConstructionDraft {
  if (draft.members.some(member => member.passage && passageKey(member.passage) === passageKey(passage))) return draft;
  if (draft.members.length >= 96) throw new Error('This authoring view supports 96 members. Split this working selection into reusable constellations. No members have been discarded.');
  return {...draft, members: [...draft.members, {subject_ref: passage.source_ref, participation_ref: newRef('participation:wiki'),
    role_ref: null, label: passage.text, sources: [passageProvenance(passage)], passage}]};
}
export function withForm(draft: ConstructionDraft, form?: AuthoringForm): ConstructionDraft {
  const roles = new Set(form?.roles.map(role => role.role_ref));
  return {...draft, form: form ? nativeFrame(form) : null,
    members: draft.members.map(member => ({...member, role_ref: member.role_ref && roles.has(member.role_ref) ? member.role_ref : null}))};
}
export function withoutMember(draft: ConstructionDraft, reference: string): ConstructionDraft {
  return {...draft, members: draft.members.filter(member => member.participation_ref !== reference),
    relations: draft.relations.filter(edge => edge.from !== reference && edge.to !== reference)};
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function draftRequest(draft: ConstructionDraft): ConstructionRequest {
  if (!draft.title.trim() || !draft.question.trim()) throw new Error('Give this constellation a title and an inquiry.');
  if (draft.basis) editable(draft.basis);
  else if (!draft.space_ref) throw new Error('Choose the Wiki space in which to create this constellation.');
  const changes: Record<string, unknown>[] = [], before = new Map(draft.basis?.constellations[0].members.map(member => [member[PARTICIPATION].participation_ref, member]));
  const roleRefs = new Set(draft.form?.roles.map(role => role.role_ref));
  if (draft.members.some(member => member.role_ref && !roleRefs.has(member.role_ref))) throw new Error('A member still names a role outside the chosen frame. Reassign that role.');
  if (!draft.basis) changes.push({change: 'create', anchor_ref: draft.anchor_ref, title: draft.title.trim(), inquiry: {question: draft.question.trim()}, space_refs: [draft.space_ref], frame: draft.form});
  else {
    const previous = draft.basis[CONSTRUCTION];
    if (previous.title !== draft.title.trim() || previous.inquiry.question !== draft.question.trim()) changes.push({change: 'inquiry_set', title: draft.title.trim(), inquiry: {...previous.inquiry, question: draft.question.trim()}});
    if (!same(previous.frame ?? null, draft.form)) changes.push({change: 'frame_set', frame: draft.form});
  }
  const relations = new Map(draft.relations.map(edge => [edge.ref, edge]));
  // Retractions precede removal of any member they used to connect.
  for (const edge of draft.original_relations) if (edge[RELATION].standing !== 'retracted' && !relations.has(edge.ref)) changes.push({change: 'relation_retract', relation_ref: edge.ref, expected_revision: edge.revision, reason: 'Removed while editing this constellation'});
  for (const [reference] of before) if (!draft.members.some(member => member.participation_ref === reference)) changes.push({change: 'member_remove', participation_ref: reference});
  for (const member of draft.members) {
    const previous = before.get(member.participation_ref)?.[PARTICIPATION];
    if (!previous) changes.push({change: 'member_add', member: {subject_ref: member.subject_ref, participation: {participation_ref: member.participation_ref, role_ref: member.role_ref, sources: member.sources, note: member.label}}});
    else if ((previous.role_ref ?? null) !== member.role_ref) changes.push({change: 'role_set', participation_ref: member.participation_ref, role_ref: member.role_ref});
  }
  const ids = new Set(draft.members.map(member => member.participation_ref));
  for (const edge of draft.relations) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || !edge.relation.trim()) throw new Error('Each relationship needs two members and a named meaning.');
    const previous = draft.original_relations.find(item => item.ref === edge.ref);
    const meta = previous?.[RELATION];
    if (previous && previous.relation === edge.relation && meta?.from_participation_ref === edge.from && meta.to_participation_ref === edge.to && meta.direction === edge.direction && meta.standing === edge.standing && same(meta.evidence ?? [], edge.evidence)) continue;
    changes.push({change: 'relation_put', relation: {relation_ref: edge.ref, expected_revision: edge.revision ?? null,
      from_participation_ref: edge.from, to_participation_ref: edge.to, relation: edge.relation.trim(), direction: edge.direction, standing: edge.standing, evidence: edge.evidence,
      ...(meta?.uncertainty ? {uncertainty: meta.uncertainty} : {})}});
  }
  if (!changes.length) throw new Error('This constellation already matches its saved revision.');
  if (changes.length > 256) throw new Error('This edit exceeds the native transaction budget. Make a smaller coherent change; the draft is retained.');
  return {schema: 'aikit.constellation-action/v1', frame_ref: draft.frame_ref, expected_revision: draft.basis?.revision ?? 0, actor_ref: ACTOR, operation_ref: newRef('operation:wiki'), changes};
}
