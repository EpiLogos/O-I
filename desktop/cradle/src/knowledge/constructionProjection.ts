import {requireExpressionOutcome} from './expressionOutcome';
import {requireSavedExpression} from './expressionSaveReceipt';
import {kernelOp} from '../kernel/bridge';
import type {CentralLocation, KernelTransportStatus, NativeFileReading} from '../kernel/types';
import type {ExpressionDocument, ExpressionRequest, ExpressionResult, ReadingRef} from '../expression/types';
import {knowledge} from './client';
import {projectProvidedLocalWhole, type LocalMember, type LocalWhole, type ProjectionOutcome} from './expressionProjection';
import {ACTOR, CONSTRUCTION, PARTICIPATION, RELATION, editConstruction, saveConstruction, decodeRegister, type ApplyKernel, type ConstructionRequest, type NativeConstruction, type NativeRelation, type WikiRegister, type SavedConstruction} from './construction';
import {readFile} from '../files/client';

/** Projection uses native participation identities as occurrences and keeps
 * source identity in the binding. A source reused in two roles stays two bodies. */
export async function constructionWhole(transport: KernelTransportStatus, project: string | undefined, frame: NativeConstruction, relations: NativeRelation[], register?: WikiRegister): Promise<LocalWhole> {
  let registerReading: ReadingRef | undefined;
  if (register) {
    const file = await readFile(transport, register.file.location);
    if (file.revision !== register.file.revision) throw new Error('The constellation register changed; refresh it before opening its live composition.');
    const current = decodeRegister(file, register.source_ref).frames.find(row => row.ref === frame.ref);
    if (!current || current.revision !== frame.revision || !sameComposition(current, frame)) throw new Error('The constellation no longer matches its exact register basis; refresh it before opening.');
    registerReading = {ref: `wiki:${file.location.path}`, revision: file.revision, availability: 'available'};
  }
  const meta = frame[CONSTRUCTION], sourceReads = new Map<string, Promise<import('../kernel/types').KnowledgeReading>>();
  const memberReads = new AbortController();
  const readMember = async (member: NativeConstruction['constellations'][number]['members'][number]) => {
    const part = member[PARTICIPATION];
    let pending = sourceReads.get(member.ref);
    if (!pending) {pending = knowledge(transport, project, {action: 'read', address: {kind: part.sources.some(s => s.source_ref === member.ref) ? 'source' : 'wiki', value: member.ref}}, {fresh: true, signal: memberReads.signal}); sourceReads.set(member.ref, pending);}
    const reading = await pending;
    if (reading.resource !== member.ref || !reading.revision) throw new Error(`The native source for ${member.ref} is unavailable or redirected.`);
    for (const source of part.sources) if (source.source_ref === reading.resource && source.source_revision !== reading.revision) throw new Error(`Source changed: ${member.ref}. Reconcile the constellation before presenting its interpretation as current.`);
    const role = meta.frame?.roles.find(role => role.role_ref === part.role_ref);
    const coordinate = role?.address.layout as {x?: unknown; y?: unknown; z?: unknown} | undefined;
    const initialPosition = coordinate && [coordinate.x, coordinate.y, coordinate.z].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100)
      ? {x: Number(coordinate.x) * 110, y: Number(coordinate.y) * 110, z: Number(coordinate.z) * 110} : undefined;
    const sources: ReadingRef[] = part.sources.map(source => ({ref: String(source.source_ref), revision: String(source.source_revision), availability: 'available'}));
    return {node: {ref: part.participation_ref, subject_ref: member.ref, frame_ref: frame.ref, label: role ? `${role.label} · ${part.note || member.ref}` : part.note || member.ref,
      kind: 'constellation-member', native_owner: 'ai-kit', provenance: {source: frame.ref, revision: String(frame.revision)}, actions: []},
      reading, sources, initialPosition, frameReading: {ref: frame.ref, revision: String(frame.revision), availability: 'available'} as ReadingRef, registerReading} as LocalMember;
  };
  // A native frame may contain more members than the shared read queue can
  // hold. Feed that existing coordinator incrementally; preserve native order,
  // deduplication and refusal semantics instead of raising its global budget.
  const nativeMembers = frame.constellations[0].members;
  const members: LocalMember[] = new Array(nativeMembers.length);
  let next = 0, failed = false;
  let failure: unknown;
  try {
    await Promise.all(Array.from({length: Math.min(4, nativeMembers.length)}, async () => {
      while (!failed && next < nativeMembers.length) {
        const index = next++;
        try { members[index] = await readMember(nativeMembers[index]); }
        catch (error) {
          if (!failed) { failed = true; failure = error; memberReads.abort(); }
          throw error;
        }
      }
    }));
  } catch (error) { throw failed ? failure : error; }
  if (!members.length) throw new Error('This frame has open roles but no source members yet. Add material before opening its live composition.');
  const ids = new Set(members.map(member => member.node.ref));
  const active = relations.filter(edge => edge[RELATION].standing !== 'retracted' && ids.has(edge[RELATION].from_participation_ref) && ids.has(edge[RELATION].to_participation_ref));
  return {locus: members[0].node.ref, members, edges: active.map(edge => ({from: edge[RELATION].from_participation_ref, to: edge[RELATION].to_participation_ref, relation: edge.relation, reference: edge.ref, origin: {provider: 'ai-kit', revision: String(edge.revision)}})),
    ownerRelations: active.map(edge => ({from: edge[RELATION].from_participation_ref, to: edge[RELATION].to_participation_ref,
      relation: {ref: edge.ref, revision: String(edge.revision), availability: 'available'}, provenance: [{ref: frame.ref, revision: String(frame.revision), availability: 'available'}]})),
    truncated: false, warnings: [], pinned: [], grammar: {state: 'unavailable', detail: 'Explicit native role addresses govern this authored frame; no discovered interpretation is inferred.'}, relationBindingsUnavailable: 0};
}
export async function projectConstruction(transport: KernelTransportStatus, project: string | undefined, frame: NativeConstruction, relations: NativeRelation[], register: WikiRegister): Promise<ProjectionOutcome> {
  const whole = await constructionWhole(transport, project, frame, relations, register);
  return projectProvidedLocalWhole(transport, `constellation:${frame.ref}`, frame[CONSTRUCTION].title, whole);
}
export async function expressionOperation(transport: KernelTransportStatus, request: ExpressionRequest, apply?: ApplyKernel): Promise<ExpressionResult> {
  const response = apply ? {outcome: await apply({op: 'expression', request})} : await kernelOp(transport, {op: 'expression', request});
  if (response.outcome?.result !== 'expression') throw new Error(('error' in response ? response.error : undefined) ?? 'The Expression owner did not return a result.');
  const value = response.outcome.data;
  requireExpressionOutcome(value, request.operation);
  return value;
}
/** Compare JSON documents structurally, independently of property order. */
export function sameComposition(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
    return JSON.stringify(value);
  };
  return canonical(a) === canonical(b);
}
export interface ArtifactReturn {file: NativeFileReading; document: ExpressionDocument; returned?: SavedConstruction}

/** Save the actual current working composition, not a copied scene or metadata
 * pretending to be an artifact. Attachment remains a separately retryable act. */
export async function saveCompositionFile(transport: KernelTransportStatus, document: ExpressionDocument, destination: {parent: CentralLocation; name: string; operation_ref: string} | {location: CentralLocation; revision: string}, apply?: ApplyKernel): Promise<ArtifactReturn> {
  const current = await expressionOperation(transport, {operation: 'inspect', expression_ref: document.expression_ref});
  if (!current.document) throw new Error('Reopen the working composition before saving it.');
  const result = await expressionOperation(transport, 'location' in destination
    ? {operation: 'save', expression_ref: document.expression_ref, expected_revision: current.document.revision, location: destination.location, expected_file_revision: destination.revision, actor: ACTOR, actor_kind: 'human'}
    : {operation: 'save_as', expression_ref: document.expression_ref, expected_revision: current.document.revision, parent: destination.parent, name: destination.name, operation_ref: destination.operation_ref, actor: ACTOR, actor_kind: 'human'}, apply);
  requireSavedExpression(result);
  const file = await readFile(transport, result.file.location);
  if (file.revision !== result.file.revision) throw new Error('The saved artifact changed before readback. Its save is not replayed automatically.');
  if (!sameComposition(JSON.parse(file.content), current.document)) throw new Error('The saved file does not match the intended composition. Inspect it before Return.');
  return {file, document: current.document};
}
/** Prepare the exact Return separately so the containing surface can retain
 * its native operation identity before dispatch, just as it does for a save. */
function compositionReturnChange(frame: NativeConstruction, artifact: ArtifactReturn): Record<string, unknown> {
  const source_ref = artifact.file.source?.ref ?? artifact.file.location.ref;
  return {change: 'composition_attach', composition: {
    reference: artifact.document.expression_ref, revision: String(artifact.document.revision), kind: 'expression',
    source: {source_ref, source_revision: artifact.file.revision, 'oi.expression-file/v1': {location: artifact.file.location}},
    derivation_refs: [...new Set(frame.constellations[0].members.map(member => member.ref))],
  }};
}
export function compositionReturnRequest(frame: NativeConstruction, artifact: ArtifactReturn): ConstructionRequest {
  return editConstruction(frame, [compositionReturnChange(frame, artifact)]);
}

/** Recorded presence is an independent native reading, not a synthetic Action
 * receipt. Use it to show that the exact artifact is already attached. */
export function compositionAttached(frame: NativeConstruction | undefined, artifact: ArtifactReturn | undefined): boolean {
  if (!frame || !artifact) return false;
  const source_ref = artifact.file.source?.ref ?? artifact.file.location.ref;
  return Boolean(frame[CONSTRUCTION].compositions?.some(item => item.reference === artifact.document.expression_ref
    && item.revision === String(artifact.document.revision) && item.kind === 'expression'
    && item.source.source_ref === source_ref && item.source.source_revision === artifact.file.revision
    && sameComposition(item.source['oi.expression-file/v1'], {location: artifact.file.location})));
}

/** Recovery requires the native operation record AND the intended attachment
 * still being present. A later replacement/retraction is not recovered as an
 * unchanged Return merely because its historical operation id still exists. */
export function compositionReturnRecorded(frame: NativeConstruction, request: ConstructionRequest): boolean {
  if (request.frame_ref !== frame.ref || request.changes.length !== 1 || request.changes[0].change !== 'composition_attach') return false;
  const recorded = frame[CONSTRUCTION].applied?.[request.operation_ref];
  return Boolean(recorded && recorded.actor_ref === request.actor_ref
    && recorded.basis_revision === request.expected_revision
    && recorded.result_revision === request.expected_revision + 1
    && frame.revision >= recorded.result_revision
    && typeof recorded.request_digest === 'string' && /^[a-f0-9]{64}$/.test(recorded.request_digest)
    && frame[CONSTRUCTION].compositions?.some(item => sameComposition(item, request.changes[0].composition)));
}

export async function attachCompositionReturn(transport: KernelTransportStatus, project: string | undefined, register: WikiRegister, frame: NativeConstruction, artifact: ArtifactReturn, apply?: ApplyKernel, retained?: ConstructionRequest): Promise<SavedConstruction> {
  const request = retained ?? compositionReturnRequest(frame, artifact);
  // A restored checkpoint can name an operation only for this exact attachment;
  // it cannot smuggle other edits through an apparently harmless Return button.
  if (request.schema !== 'aikit.constellation-action/v1' || request.frame_ref !== frame.ref
    || request.expected_revision !== frame.revision || request.actor_ref !== ACTOR
    || !sameComposition(request.changes, [compositionReturnChange(frame, artifact)])) throw new Error('The retained Return no longer matches this exact constellation and artifact. Inspect it before continuing.');
  const source_ref = artifact.file.source?.ref ?? artifact.file.location.ref;
  const result = await saveConstruction(transport, project, register, request, [], apply, [{source_ref, revision: artifact.file.revision, location: artifact.file.location}]);
  // Idempotent native replay may return a later whole. The historical operation
  // alone cannot prove its attachment is still present after another edit.
  if (!result.reading.frame[CONSTRUCTION].compositions?.some(item => sameComposition(item, request.changes[0].composition))) throw new Error('The native Return was acknowledged, but its current attachment differs from the retained request. Inspect the current constellation; the artifact remains saved.');
  return result;
}

/** Reopen the actual native file after a process restart. A retained reference
 * alone never pretends the working Expression document is already mounted. */
export async function reopenComposition(transport: KernelTransportStatus, item: {reference: string; revision: string; source: Record<string, unknown>}, apply?: ApplyKernel): Promise<ExpressionDocument> {
  const facet = item.source['oi.expression-file/v1'] as {location?: CentralLocation} | undefined;
  const location = facet?.location;
  if (!location || location.schema !== 'central.path-ref/v1' || !location.ref || !location.root || typeof location.path !== 'string') throw new Error('This older Return has no native artifact location. Open its source file to resume the composition.');
  const reading = await readFile(transport, location);
  if (reading.revision !== item.source.source_revision) throw new Error('The returned artifact has changed. Open and review its current source before replacing the recorded composition.');
  const native = JSON.parse(reading.content) as Partial<ExpressionDocument>;
  if (native.schema !== 'oi.expression/v1' || native.expression_ref !== item.reference || String(native.revision) !== item.revision) throw new Error('The returned file no longer names this exact Expression revision.');
  const result = await expressionOperation(transport, {operation: 'open_file', location, actor: ACTOR}, apply);
  if (!result.document || result.document.expression_ref !== item.reference) throw new Error('The Expression owner did not reopen the returned file.');
  return result.document;
}
