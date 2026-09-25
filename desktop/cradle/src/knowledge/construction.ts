import type {TechneTemporalFacet,TechnePlaceFacet} from '../techne/contract';
import {kernelOp} from '../kernel/bridge';
import type {CentralLocation, KernelOp, KernelOutcome, KernelTransportStatus, NativeFileReading} from '../kernel/types';
import {listFiles, readFile} from '../files/client';
import {readGraph} from './graph';
import {passageProvenance, revalidatePassage, type WikiPassage} from './selection';

export const CONSTRUCTION = 'aikit.constellation/v1';
export const PARTICIPATION = 'aikit.constellation-participation/v1';
export const RELATION = 'aikit.constellation-relation/v1';
export const ACTOR = 'human:cradle-wiki'; // Attribution, not an authority grant.
export interface NativeRole {role_ref: string; label: string; address: Record<string, unknown>}
export interface NativeFrame {shape_ref: string; contract_ref: string; roles: NativeRole[]; provenance: Record<string, unknown>[]; standing: string}
export interface AuthoringForm extends NativeFrame {id: string; label: string}
export interface NativeMember {'aikit.techne-facet/v1'?: {contract:'aikit.techne-facet/v1';temporal?:TechneTemporalFacet[];spatial?:TechnePlaceFacet[]};ref: string; position?: number | null; conjugate?: boolean; [PARTICIPATION]: {participation_ref: string; role_ref?: string | null; sources: Record<string, unknown>[]; note?: string}}
export interface NativeRelation {ref: string; revision: number; from_ref: string; to_ref: string; relation: string; [RELATION]: {from_participation_ref: string; to_participation_ref: string; direction: string; standing: string; evidence: Record<string, unknown>[]; uncertainty?: string | null; temporal?: unknown[]}}
export interface NativeConstruction {
  ref: string; revision: number;
  constellations: {anchor_ref: string; members: NativeMember[]; returns?: unknown[]}[];
  [CONSTRUCTION]: {title: string; inquiry: {question: string; purpose?: string}; frame?: NativeFrame | null; compositions?: {reference: string; revision: string; kind: string; source: Record<string, unknown>}[]; applied?: Record<string, {actor_ref: string; request_digest: string; basis_revision: number; result_revision: number}>};
  read_only?: boolean; shared_projection_ref?: string;
}
export interface WikiRegister {file: NativeFileReading; source_ref: string; spaces: {ref: string; label: string}[]; frames: NativeConstruction[]; relations: NativeRelation[]}
export interface ConstructionRequest {schema: 'aikit.constellation-action/v1'; frame_ref: string; expected_revision: number; actor_ref: string; operation_ref: string; changes: Record<string, unknown>[]}
export interface SavedConstruction {schema: string; frame_ref: string; revision: number; persisted: true; state: 'saved' | 'unchanged'; reading: {frame: NativeConstruction; construction: NativeConstruction[typeof CONSTRUCTION]; relations: NativeRelation[]}; native_file?: {location: CentralLocation; revision: string}; indexed_availability_proven?: boolean; continuity_warnings?: string[]}
export type ApplyKernel = (op: KernelOp) => Promise<KernelOutcome | null | undefined>;
export const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const validReference = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length < 4096 && !value.includes('\0');
export const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const ref = validReference, revision = validRevision;
export const newRef = (kind: string): string => `${kind}:${crypto.randomUUID()}`;

export async function invoke<T>(transport: KernelTransportStatus, project: string | undefined, action: string, target_ref: string, input?: Record<string, unknown>, apply?: ApplyKernel): Promise<T> {
  const op: KernelOp = {op: 'invoke_action', project, invocation: {action, target_ref, input}};
  const response = apply ? {outcome: await apply(op)} : await kernelOp(transport, op);
  if (response.outcome?.result !== 'action_dispatched') throw new Error(('error' in response ? response.error : undefined) ?? 'The kernel did not return the requested native action.');
  const dispatch = response.outcome.dispatch;
  if (dispatch.state !== 'invoked') throw new Error('message' in dispatch ? dispatch.message : 'detail' in dispatch ? dispatch.detail : `Native action unavailable: ${action}`);
  return dispatch.data as T;
}

/** Read-only decoding of the native register for controls. Unknown records and
 * extensions are left in the native file; requests never rewrite this JSON. */
export function decodeRegister(file: NativeFileReading, source_ref: string): WikiRegister {
  const raw: unknown = JSON.parse(file.content);
  const rows = Array.isArray(raw) ? raw : object(raw) && Array.isArray(raw.objects) ? raw.objects : undefined;
  if (!rows) throw new Error('The native Wiki register has no object collection.');
  const frames: NativeConstruction[] = [], relations: NativeRelation[] = [], spaces: WikiRegister['spaces'] = [];
  for (const row of rows) {
    if (!object(row) || !ref(row.ref)) continue;
    if (row.object === 'space') spaces.push({ref: row.ref, label: typeof row.title === 'string' ? row.title : row.ref});
    if (row.object === 'frame' && row[CONSTRUCTION] !== undefined) {
      const frame = row as unknown as NativeConstruction;
      if (!revision(frame.revision) || !object(frame[CONSTRUCTION]) || typeof frame[CONSTRUCTION].title !== 'string' || !object(frame[CONSTRUCTION].inquiry) || typeof frame[CONSTRUCTION].inquiry.question !== 'string' || !Array.isArray(frame.constellations) || frame.constellations.length !== 1 || !Array.isArray(frame.constellations[0].members)) throw new Error('A constructive frame is malformed; inspect its native source before editing.');
      for (const member of frame.constellations[0].members) if (!ref(member.ref) || !object(member[PARTICIPATION]) || !ref(member[PARTICIPATION].participation_ref) || !Array.isArray(member[PARTICIPATION].sources)) throw new Error('A native member has no valid contextual participation.');
      if (frame[CONSTRUCTION].frame && !validNativeFrame(frame[CONSTRUCTION].frame)) throw new Error('The saved frame has malformed native roles. Its register has not been changed.');
      frames.push(frame);
    }
    if (row.object === 'edge' && object(row[RELATION]) && revision(row.revision)) {
      const meta = row[RELATION];
      if (!ref(meta.from_participation_ref) || !ref(meta.to_participation_ref) || !ref(row.relation) || !ref(meta.direction) || !ref(meta.standing) || !Array.isArray(meta.evidence)) throw new Error('A constructive relationship is malformed. Inspect its native source.');
      relations.push(row as unknown as NativeRelation);
    }
  }
  return {file, source_ref, spaces, frames, relations};
}

/** Central discloses the register and its real location. Paths below are only
 * navigation operands derived from that disclosure, never minted source refs. */
export async function readRegister(transport: KernelTransportStatus, project?: string): Promise<WikiRegister> {
  // A Wiki may be opened directly, before the shell has visited Central.
  // Root disclosure establishes the native Project boundary; project_browse
  // must not rely on unrelated navigation having happened earlier in the UI.
  const world = await kernelOp(transport, {op: 'world_browse', fresh: true});
  if (world.error || world.outcome?.result !== 'world_read') throw new Error(world.error ?? 'Central could not disclose the root world.');
  let navigator = world.outcome.snapshot.navigator;
  if (!navigator?.root) throw new Error(navigator?.error ?? 'Central did not return its root mapping.');
  let projectPath = '';
  if (project) {
    if (!navigator.root.work.projects.some(item => item.name === project)) throw new Error('The selected Project is outside the disclosed Central world.');
    const response = await kernelOp(transport, {op: 'project_browse', project, fresh: true});
    if (response.error || response.outcome?.result !== 'world_read') throw new Error(response.error ?? 'Central could not disclose the selected Project.');
    navigator = response.outcome.snapshot.navigator;
    if (navigator?.project?.project.name !== project || !navigator.project.project.path) throw new Error(navigator?.error ?? 'The selected Project has no native directory disclosure.');
    projectPath = navigator.project.project.path;
  }
  const wiki = await invoke<Record<string, unknown>>(transport, project, project ? 'projectcentral.wiki.read' : 'central.wiki.read', project ?? 'control:root', project ? {project} : {project: null});
  const source = wiki.source;
  if (wiki.schema !== 'central.wiki-reading/v1' || !object(source) || !ref(source.path) || !ref(source.ref) || !ref(source.revision)) throw new Error('Central did not disclose a current Wiki register.');
  if (source.path.startsWith('/') || source.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('The Wiki register location is outside the selected ground.');
  const relative = [projectPath, source.path].filter(Boolean).join('/');
  const slash = relative.lastIndexOf('/'), parent = relative.slice(0, slash), name = relative.slice(slash + 1);
  const directory = await listFiles(transport, parent, true);
  const entry = directory.entries.find(item => item.name === name && item.kind === 'file');
  if (!entry) throw new Error('The disclosed Wiki register is not readable in its native directory.');
  const file = await readFile(transport, entry.location);
  if (file.revision !== source.revision) throw new Error('The Wiki register changed during discovery; refresh before editing.');
  return decodeRegister(file, source.ref);
}

export function validNativeFrame(item: unknown): item is NativeFrame {
  return object(item) && ref(item.shape_ref) && ref(item.contract_ref) && ref(item.standing)
    && Array.isArray(item.provenance) && item.provenance.length <= 256 && item.provenance.every(object)
    && Array.isArray(item.roles) && item.roles.length <= 256
    && item.roles.every(role => object(role) && ref(role.role_ref) && ref(role.label) && object(role.address))
    && new Set(item.roles.map(role => role.role_ref)).size === item.roles.length;
}
export function readAuthoringForms(value: unknown): AuthoringForm[] {
  if (!object(value) || value.schema !== 'aikit.ql-authoring-forms/v1' || !Array.isArray(value.forms)) return [];
  return value.forms.filter((item): item is AuthoringForm => validNativeFrame(item) && ref((item as AuthoringForm).id) && ref((item as AuthoringForm).label));
}
export async function authoringForms(transport: KernelTransportStatus, project?: string): Promise<AuthoringForm[]> {
  const graph = await readGraph(transport, project, '', {input: 'aikit_resolution'});
  return readAuthoringForms((graph as unknown as Record<string, unknown>).shape_catalog);
}
export function nativeFrame(form: AuthoringForm): NativeFrame {
  const {shape_ref, contract_ref, roles, provenance, standing} = form;
  return {shape_ref, contract_ref, roles, provenance, standing};
}
export function editable(frame: NativeConstruction): void {
  if (frame.read_only || frame.shared_projection_ref) throw new Error('This shared construction is read-only. Make an explicit local derivative instead.');
}
export function newConstruction(title: string, question: string, space: string, form?: AuthoringForm): ConstructionRequest {
  if (!title.trim() || !question.trim() || !ref(space)) throw new Error('Name the inquiry, add its question, and select its Wiki space.');
  return {schema: 'aikit.constellation-action/v1', frame_ref: newRef('wiki:frame'), expected_revision: 0, actor_ref: ACTOR,
    operation_ref: newRef('operation:wiki'), changes: [{change: 'create', anchor_ref: newRef('wiki:anchor'), title: title.trim(), inquiry: {question: question.trim()}, space_refs: [space], frame: form ? nativeFrame(form) : null}]};
}
export function editConstruction(frame: NativeConstruction, changes: Record<string, unknown>[]): ConstructionRequest {
  editable(frame);
  return {schema: 'aikit.constellation-action/v1', frame_ref: frame.ref, expected_revision: frame.revision, actor_ref: ACTOR, operation_ref: newRef('operation:wiki'), changes};
}
export function memberChange(passage: WikiPassage, role_ref?: string): Record<string, unknown> {
  return {change: 'member_add', member: {subject_ref: passage.source_ref, participation: {participation_ref: newRef('participation:wiki'), role_ref: role_ref ?? null, sources: [passageProvenance(passage)], note: passage.text}}};
}
export function sourceBases(request: {changes:Record<string,unknown>[]}, facetBases: {source_ref:string;revision:string}[]=[]): {source_ref: string; revision: string}[] {
  const sources = new Map<string, {source_ref: string; revision: string}>();
  const visit = (value: unknown, nativeFacet=false) => {
    if (Array.isArray(value)) {value.forEach(row=>visit(row)); return;}
    if (!object(value)) return;
    if ('source_ref' in value) {
      const matches=facetBases.filter(row=>row.source_ref===value.source_ref);
      const sourceRevision=nativeFacet ? (matches.length&&new Set(matches.map(row=>row.revision)).size===1?matches[0].revision:undefined) : value.source_revision;
      if(nativeFacet&&value.source_revision!==undefined)throw new Error('Native time/place facts take revision from their separately verified source.');
      if (!ref(value.source_ref) || !ref(sourceRevision)) throw new Error(nativeFacet?'Choose and read the exact evidence file for each time/place fact before saving.':'Every cited source needs an exact revision.');
      const prior = sources.get(value.source_ref);
      if (prior && prior.revision !== sourceRevision) throw new Error('The proposal mixes revisions of the same source. Reconcile it before saving.');
      sources.set(value.source_ref, {source_ref: value.source_ref, revision: sourceRevision});
    }
    for(const [key,nested]of Object.entries(value)){
      if((value.change==='temporal_set'&&key==='temporal')||(value.change==='place_set'&&key==='places')){if(!Array.isArray(nested))throw new Error('Native time/place facts must be a list.');nested.forEach(row=>visit(row,true));}
      else visit(nested);
    }
  };
  visit(request);
  return [...sources.values()];
}

/** No optimistic semantic mutation. A rejected/uncertain operation leaves the
 * caller's draft and operation identity intact for inspection or exact retry. */
export async function saveConstruction(transport: KernelTransportStatus, project: string | undefined, register: WikiRegister, request: ConstructionRequest, passages: WikiPassage[], apply?: ApplyKernel, fileBases: {source_ref: string; revision: string; location: CentralLocation}[] = []): Promise<SavedConstruction> {
  // The shared coordinator deduplicates identical in-flight source reads and
  // bounds concurrency; no sequential reread per passage from the same file.
  await Promise.all(passages.map(passage => revalidatePassage(transport, project, passage)));
  const result = await invoke<SavedConstruction>(transport, project, 'aikit.constellation.apply', request.frame_ref,
    {location: register.file.location, expected_file_revision: register.file.revision, request, sources: sourceBases(request,fileBases).map(basis => {const file=fileBases.find(file => file.source_ref === basis.source_ref && file.revision === basis.revision);return file?{...basis,location:file.location}:basis;})}, apply);
  if (result.persisted !== true || result.frame_ref !== request.frame_ref || !revision(result.revision) || !['saved', 'unchanged'].includes(result.state) || result.reading?.frame?.ref !== request.frame_ref) throw new Error('No matching native persistence receipt was returned. Keep this draft and inspect the register before retrying.');
  return result;
}
