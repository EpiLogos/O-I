import type {ArtifactSaveIntent} from './artifactRecovery';
import type {CentralLocation} from '../kernel/types';
import {CONSTRUCTION, PARTICIPATION, RELATION, object, validReference as ref, validRevision as revision, validNativeFrame,
  type ConstructionRequest} from './construction';
import type {ConstructionDraft, DraftMember} from './constructionDraft';
import type {WikiAnchor} from './wikiDocument';

export interface ConstructionCheckpoint {
  draft: ConstructionDraft;
  pending?: ConstructionRequest;
  artifact?: {location: CentralLocation; revision: string; expression_ref: string};
  saved?: boolean;
  artifactSave?: ArtifactSaveIntent;
}
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const records = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.length <= 256 && value.every(object);
const location = (value: unknown): value is CentralLocation => object(value) && value.schema === 'central.path-ref/v1' && ref(value.ref) && ref(value.root) && bounded(value.path, 4096);

/** Restoration is validation of editor input, not permission or native truth.
 * Malformed checkpoints are preserved by the caller for explicit recovery. */
export function restoreConstructionCheckpoint(value: unknown): ConstructionCheckpoint | undefined {
  if (value === undefined) return undefined;
  if (JSON.stringify(value).length > 2 * 1024 * 1024 || !object(value) || !object(value.draft)) throw new Error('The saved constellation draft is malformed or exceeds its 2 MiB recovery budget.');
  const d = value.draft;
  const fail = () => {throw new Error('The saved constellation draft cannot be restored safely. Its original checkpoint is retained.');};
  if (!ref(d.frame_ref) || !ref(d.anchor_ref) || !bounded(d.title, 512) || !bounded(d.question, 4096) || !bounded(d.space_ref, 4096) || (d.form !== null && !validNativeFrame(d.form)) || !Array.isArray(d.members) || d.members.length > 4096 || !Array.isArray(d.relations) || d.relations.length > 4096 || !Array.isArray(d.original_relations)) return fail();
  for (const m of d.members) {
    if (!object(m) || !ref(m.subject_ref) || !ref(m.participation_ref) || (m.role_ref !== null && !ref(m.role_ref)) || !bounded(m.label, 12000) || !records(m.sources)) return fail();
    if (m.passage !== undefined) {
      const p = m.passage;
      if (!object(p) || p.schema !== 'oi.wiki-passage/v1' || p.source_ref !== m.subject_ref || !ref(p.source_revision) || !object(p.address) || p.address.kind !== 'source' || p.address.value !== p.source_ref || !object(p.selector) || !Number.isSafeInteger(p.selector.start_byte) || !Number.isSafeInteger(p.selector.end_byte) || Number(p.selector.start_byte) < 0 || Number(p.selector.end_byte) <= Number(p.selector.start_byte) || !bounded(p.source_text, 65536) || !bounded(p.text, 12000) || !bounded(p.title, 512) || !ref(p.provider)) return fail();
    }
  }
  const ids = new Set(d.members.map(m => m.participation_ref));
  if (ids.size !== d.members.length) return fail();
  for (const edge of d.relations) if (!object(edge) || !ref(edge.ref) || !ids.has(edge.from) || !ids.has(edge.to) || !bounded(edge.relation, 256) || !ref(edge.direction) || !ref(edge.standing) || !records(edge.evidence)) return fail();
  if (d.basis !== undefined) {
    const frame = d.basis;
    if (!object(frame) || frame.ref !== d.frame_ref || !revision(frame.revision) || !object(frame[CONSTRUCTION]) || !object(frame[CONSTRUCTION].inquiry) || !bounded(frame[CONSTRUCTION].title, 512) || !bounded(frame[CONSTRUCTION].inquiry.question, 4096) || (frame[CONSTRUCTION].frame != null && !validNativeFrame(frame[CONSTRUCTION].frame)) || !Array.isArray(frame.constellations) || frame.constellations.length !== 1 || !object(frame.constellations[0]) || !Array.isArray(frame.constellations[0].members)) return fail();
    for (const member of frame.constellations[0].members) if (!object(member) || !ref(member.ref) || !object(member[PARTICIPATION]) || !ref(member[PARTICIPATION].participation_ref) || !records(member[PARTICIPATION].sources)) return fail();
  }
  for (const edge of d.original_relations) if (!object(edge) || !ref(edge.ref) || !revision(edge.revision) || !object(edge[RELATION]) || !ref(edge[RELATION].from_participation_ref) || !ref(edge[RELATION].to_participation_ref)) return fail();
  if (value.pending !== undefined && (!object(value.pending) || value.pending.schema !== 'aikit.constellation-action/v1' || value.pending.frame_ref !== d.frame_ref || !ref(value.pending.operation_ref) || !ref(value.pending.actor_ref) || !Number.isSafeInteger(value.pending.expected_revision) || Number(value.pending.expected_revision) < 0 || !records(value.pending.changes))) return fail();
  if (value.artifact !== undefined && (!object(value.artifact) || !location(value.artifact.location) || !ref(value.artifact.revision) || !ref(value.artifact.expression_ref))) return fail();
  if (value.artifactSave !== undefined) {
    const intent = value.artifactSave;
    if (!object(intent) || intent.schema !== 'oi.wiki-artifact-save/v1' || !object(intent.document) || intent.document.schema !== 'oi.expression/v1' || !ref(intent.document.expression_ref) || !revision(intent.document.revision) || !Array.isArray(intent.document.scenes) || !object(intent.document.entities) || !object(intent.document.relations) || !object(intent.destination)) return fail();
    const dest = intent.destination;
    if ('location' in dest) {if (!location(dest.location) || !ref(dest.revision)) return fail();}
    else if (!location(dest.parent) || !bounded(dest.name,255) || !dest.name || /[\\/\0]/.test(dest.name) || ['.','..'].includes(dest.name) || !ref(dest.operation_ref)) return fail();
  }
  return value as unknown as ConstructionCheckpoint;
}

/** A persisted native membership still opens its exact recorded source span,
 * even when the original temporary WikiPassage object no longer exists. */
export function memberAnchor(member: DraftMember): WikiAnchor | undefined {
  if (member.passage) return {revision: member.passage.source_revision, ...member.passage.selector};
  for (const source of member.sources) {
    if (source.source_ref !== member.subject_ref || !ref(source.source_revision)) continue;
    const facet = source['aikit.techne-facet/v1'];
    if (!object(facet) || !object(facet.selector) || facet.selector.unit !== 'other' || facet.selector.kind !== 'markdown-utf8-span' || typeof facet.selector.value !== 'string') continue;
    try {
      const span = JSON.parse(facet.selector.value);
      if (Number.isSafeInteger(span.start_byte) && Number.isSafeInteger(span.end_byte) && span.start_byte >= 0 && span.end_byte > span.start_byte) return {revision: source.source_revision, start_byte: span.start_byte, end_byte: span.end_byte};
    } catch { /* Do not guess an anchor for a malformed native selector. */ }
  }
  return undefined;
}
