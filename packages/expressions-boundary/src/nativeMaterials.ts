/** Native reusable-material lifecycle extracted from actPanel. The controller
 * owns no document, DOM, playback timer or processor graph: every result is
 * returned by the existing Expression/world owners. */
import {sameEditorBasis, type Journey, type NativeEditorBasis, type NativeEditorReading} from './editor';
import type {KernelConversion} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {actBindings, buildReuse, materialExpressionRef, materialFileName, remapReuse, REUSE_KINDS, type BindingInput, type ReuseForm} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/reuse';
import type {ExpressionRequest, ExpressionResult} from '../../../desktop/cradle/src/expression/types.ts';
import type {ActMaterialContract, ActOutcome, ActSummary, MaterialAssociation, MaterialListing, MaterialListResult, MaterialSelect, RetainedActEdition, WorldAct, WorldRequest} from '../../../desktop/cradle/src/expression/world.ts';

export type {ActMaterialContract, BindingInput, ReuseForm, MaterialListing, MaterialListResult, RetainedActEdition, WorldAct};
export interface NativeMaterialHost {
  reading(): NativeEditorReading;
  journey(): Journey;
  nativeView(): KernelConversion | undefined;
  /** Existing nativeWorkspace/nativeEdit flush; rejects pending/refused drafts. */
  flush(): Promise<void>;
  expressionRequest(request: ExpressionRequest): Promise<unknown>;
  worldRequest(request: WorldRequest): Promise<unknown>;
  /** Existing advanceClean; false preserves newer local work. */
  advance(basis: NativeEditorBasis): Promise<boolean>;
  transition(seconds: number, easing?: string): void;
}
export interface MaterialPerformance {
  basis: NativeEditorBasis;
  material: Pick<MaterialListing, 'file_ref' | 'revision'> & Pick<MaterialSelect, 'state' | 'scene_ref'>;
  bindings?: BindingInput[];
  transition?: {duration: number; easing?: string};
}
export interface NativeMaterialReceipt {outcome: ActOutcome; followed: boolean}
export interface SavedNativeMaterial {outcome: ExpressionResult; copy_ref: string; open_copy_ref?: string}
export interface NativeActList {state: 'acts'; acts: (ActSummary & {resident_currentness?:'stored_successor_unloaded';stored_reload_error?:string})[]; persistent: boolean; store_errors: string[]; [key: string]: unknown}
export class NativeMaterialRefusal extends Error {
  constructor(message: string, readonly outcome?: unknown, readonly retained_copy_ref?: string) {super(message); this.name = 'NativeMaterialRefusal';}
}
export type NativeMaterialReadBasis=Pick<NativeEditorReading,'basis'>&{standing:Pick<NativeEditorReading['standing'],'dirty'|'pending'>};
function captureReadBasis(reading:NativeEditorReading):NativeMaterialReadBasis {
  return {basis:{...reading.basis},standing:{dirty:reading.standing.dirty,pending:reading.standing.pending}};
}
export function sameNativeMaterialReadBasis(captured:NativeMaterialReadBasis,current:NativeMaterialReadBasis):boolean {
  return sameEditorBasis(captured.basis,current.basis)&&captured.standing.dirty===current.standing.dirty&&captured.standing.pending===current.standing.pending;
}

const ACTOR = 'human:expressions-app';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NativeMaterialRefusal('The native owner returned a malformed result.', value);
  return value as Record<string, unknown>;
}
function state(value: unknown, accepted: string): Record<string, unknown> {
  const result = record(value);
  if (result.state !== accepted) {
    const detail = result.state === 'material_revision_changed' ? 'The material changed since it was listed; refresh and choose again.'
      : result.state === 'revision_conflict' || result.state === 'act_revision_conflict' ? 'The native work advanced; read the current revision before retrying.'
      : result.state === 'act_passage_limit' ? 'This native act is full; perform again in a successor act.'
      : `The native owner refused this operation (${String(result.state)}).`;
    throw new NativeMaterialRefusal(detail, value);
  }
  return result;
}
function readAct(value: unknown): WorldAct {
  const act = record(value);
  if (typeof act.act_ref !== 'string' || typeof act.expression_ref !== 'string' || !Number.isSafeInteger(act.revision) || (act.revision as number)<1 || !Number.isSafeInteger(act.basis_revision) || (act.basis_revision as number)<0 || !Array.isArray(act.sequence)) throw new NativeMaterialRefusal('The native owner returned a malformed act.', value);
  return value as WorldAct;
}
function actReadRequest(act_ref: string, material_contract?: ActMaterialContract): {request: WorldRequest; state: string} {
  if (typeof act_ref!=='string' || !act_ref.trim() || (material_contract !== undefined && material_contract !== 'oi.expression-act-material/v2')) throw new NativeMaterialRefusal('Choose an exact native Act and its disclosed material contract.');
  return material_contract === 'oi.expression-act-material/v2'
    ? {request: {operation: 'act_retained_inspect', act_ref}, state: 'act_retained'}
    : {request: {operation: 'act_inspect', act_ref}, state: 'act'};
}
/** Qualifies an actual owner reading without rewriting its retained custody. */
export function readNativeActResult(raw: unknown, expected: {act_ref: string; expression_ref: string; material_contract?: ActMaterialContract}): WorldAct {
  const route=actReadRequest(expected.act_ref,expected.material_contract), result=state(raw,route.state), act=readAct(result.act);
  if (act.act_ref !== expected.act_ref || act.expression_ref !== expected.expression_ref || act.material_contract !== expected.material_contract
    || (expected.material_contract && result.material_contract !== expected.material_contract)) throw new NativeMaterialRefusal('This reading does not identify the requested native Act, Expression and material contract.', raw);
  return act;
}
export function readNativeActList(raw: unknown, expression_ref: string): NativeActList {
  const result=state(raw,'acts');
  if (!Array.isArray(result.acts) || typeof result.persistent !== 'boolean' || !Array.isArray(result.store_errors) || result.store_errors.some(error=>typeof error!=='string')) throw new NativeMaterialRefusal('The native act register returned a malformed list.', result);
  for (const raw of result.acts) {
    const act=record(raw);
    if (typeof act.act_ref !== 'string' || !act.act_ref.trim() || act.expression_ref !== expression_ref
      || !Number.isSafeInteger(act.revision) || (act.revision as number)<1 || !Number.isSafeInteger(act.basis_revision) || (act.basis_revision as number)<0
      || !Number.isSafeInteger(act.passages) || (act.passages as number)<0 || typeof act.summary!=='string' || typeof act.actor!=='string'
      || !['running','held','completed','cancelled'].includes(String(act.phase)) || !['factory','expressions','techne'].includes(String(act.mode))) throw new NativeMaterialRefusal('The act register returned an invalid or foreign native Act basis.', raw);
  }
  return result as unknown as NativeActList;
}
function selection(material: MaterialPerformance['material']): MaterialSelect {
  if (!material.file_ref || !material.revision) throw new NativeMaterialRefusal('Choose material with its exact native file revision.');
  if (material.state && material.scene_ref) throw new NativeMaterialRefusal('Choose either a named state or a Scene.');
  return {file_ref: material.file_ref, revision: material.revision, ...(material.state ? {state: material.state} : {}), ...(material.scene_ref ? {scene_ref: material.scene_ref} : {})};
}

/** The same typed native read is available without constructing an editing
 * host, so a Browser can discover material before an Expression is open. */
export async function listNativeMaterials(worldRequest: NativeMaterialHost['worldRequest'], input: {kind?: MaterialListing['kind']; association?: MaterialAssociation} = {}): Promise<MaterialListResult> {
  const result = state(await worldRequest({operation: 'material_list', ...input}), 'materials');
  if (result.schema !== 'oi.expression-material-list/v1' || !Array.isArray(result.materials) || !Array.isArray(result.unreadable) || !result.folders) throw new NativeMaterialRefusal('The material register returned a malformed listing.', result);
  const refs = new Set<string>();
  for (const raw of result.materials) {
    const item = record(raw);
    if (typeof item.file_ref !== 'string' || !item.file_ref || typeof item.revision !== 'string' || !item.revision || typeof item.expression_ref !== 'string' || !REUSE_KINDS.includes(item.kind as MaterialListing['kind']) || refs.has(item.file_ref)) throw new NativeMaterialRefusal('The register returned missing or duplicate material identities.', raw);
    refs.add(item.file_ref);
  }
  return result as unknown as MaterialListResult;
}

export async function listNativeActs(worldRequest: NativeMaterialHost['worldRequest'], expression_ref: string): Promise<NativeActList> {
  return readNativeActList(await worldRequest({operation: 'act_list', expression_ref}),expression_ref);
}

export function createNativeMaterialController(host: NativeMaterialHost) {
  let busy = false;
  // A native reading used only to correlate subsequent requests to its owner.
  let currentAct: WorldAct | undefined;
  const exclusive = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (busy) throw new NativeMaterialRefusal('Wait for the current native material acknowledgement.');
    busy = true;
    try {return await fn();} finally {busy = false;}
  };
  const prepare = async (basis: NativeEditorBasis) => {
    const before = host.reading();
    if (!sameEditorBasis(basis, before.basis)) throw new NativeMaterialRefusal('The editor basis changed; read the current work before performing material.');
    if (before.standing.pending) throw new NativeMaterialRefusal('Resolve the pending native acknowledgement before performing material.');
    await host.flush();
    const reading = host.reading(), view = host.nativeView();
    if (!view || reading.standing.pending || reading.standing.dirty || reading.basis.expression_ref !== basis.expression_ref || reading.basis.scene_ref !== basis.scene_ref || reading.basis.authored_revision !== basis.authored_revision
      || view.document.expression_ref !== reading.basis.expression_ref || view.document.revision !== reading.basis.revision || view.document.selection?.scene_ref !== reading.basis.scene_ref) throw new NativeMaterialRefusal('The native location or local draft changed while it was being committed; read it again.');
    return view;
  };
  const ensureAct = async (expression_ref: string, summary: string): Promise<WorldAct> => {
    const continuing = currentAct?.expression_ref === expression_ref && !['completed', 'cancelled'].includes(currentAct.phase) ? currentAct : undefined;
    const result = state(await host.worldRequest({operation: 'act_open', act_ref: continuing?.act_ref ?? `act:expressions:${crypto.randomUUID()}`, expression_ref, mode: 'expressions', actor: ACTOR, summary,
      ...(continuing ? {expected_act_revision: continuing.revision} : {})}), 'act_opened');
    const act = readAct(result.act);
    if (act.expression_ref !== expression_ref) throw new NativeMaterialRefusal('The native act belongs to another Expression.', result);
    currentAct = act;
    return act;
  };
  const retainDestination=(view:KernelConversion,basis:NativeEditorBasis)=>{
    const current=host.reading();
    if(!sameEditorBasis(current.basis,{...basis,revision:view.document.revision})||current.standing.dirty||current.standing.pending)throw new NativeMaterialRefusal('The material destination changed while the native act was returning; the human draft is retained.');
  };
  const retainReadBasis=(captured:NativeMaterialReadBasis)=>{
    const current=host.reading();
    if(!sameNativeMaterialReadBasis(captured,current)) throw new NativeMaterialRefusal('The native read destination or human draft changed; retain the reading and read the current basis.');
  };
  const performed = async (raw: unknown, expectedState: string, basis: NativeEditorBasis, expectedAct: string, transition?: MaterialPerformance['transition']): Promise<NativeMaterialReceipt> => {
    if (record(raw).state === 'act_passage_limit') currentAct = undefined;
    const result = state(raw, expectedState), act = readAct(result.act);
    if (act.expression_ref !== basis.expression_ref || act.act_ref !== expectedAct || act.basis_revision < basis.revision) throw new NativeMaterialRefusal('The performed act does not match its captured native target and revision.', raw);
    const passages=[...(Array.isArray(result.passages)?result.passages:[]),...(result.passage?[result.passage]:[])];
    if (passages.some(p=>!p || typeof p!=='object' || p.target_ref && p.target_ref!==basis.expression_ref)) throw new NativeMaterialRefusal('The performed passage belongs to another native target.', raw);
    currentAct = act;
    const current = host.reading();
    if (!sameEditorBasis(current.basis,basis) || current.standing.dirty || current.standing.pending) return {outcome: result as unknown as ActOutcome, followed:false};
    const followed=await host.advance(basis);
    const adopted=host.reading();
    const passage=(result.passage??(Array.isArray(result.passages)?result.passages.at(-1):undefined)) as ActOutcome['passage'];
    if (followed && transition && adopted.basis.expression_ref===basis.expression_ref && adopted.basis.revision===act.basis_revision && (!passage?.target_scene_ref || passage.target_scene_ref===adopted.basis.scene_ref) && !adopted.standing.dirty && !adopted.standing.pending) host.transition(transition.duration, transition.easing);
    return {outcome: result as unknown as ActOutcome, followed};
  };
  const transition = (input?: MaterialPerformance['transition']) => {
    const value = input ?? {duration: 1.5, easing: 'smoothstep'};
    if (!Number.isFinite(value.duration) || value.duration < 0 || value.duration > 3600) throw new NativeMaterialRefusal('Transition duration must be between 0 and 3600 seconds.');
    return value;
  };

  return {
    list(input: {kind?: MaterialListing['kind']; association?: MaterialAssociation} = {}): Promise<MaterialListResult> {
      return listNativeMaterials(host.worldRequest, input);
    },
    perform(input: MaterialPerformance): Promise<NativeMaterialReceipt> {
      const request = structuredClone(input);
      return exclusive(async () => {
        const material = selection(request.material), roles = actBindings(request.bindings ?? []), fade = transition(request.transition);
        const view = await prepare(request.basis), act = await ensureAct(view.document.expression_ref, 'Performing reusable material');
        retainDestination(view,request.basis);
        return performed(await host.worldRequest({operation: 'act_select', act_ref: act.act_ref, actor: ACTOR, material, ...roles,
          expected_revision: view.document.revision, expected_act_revision: act.revision, transition: fade}), 'act_performed', {...request.basis,revision:view.document.revision}, act.act_ref, fade);
      });
    },
    play(input: MaterialPerformance & {from?: number}): Promise<NativeMaterialReceipt> {
      const request = structuredClone(input);
      return exclusive(async () => {
        const material = selection(request.material), roles = actBindings(request.bindings ?? []);
        if (request.from !== undefined && (!Number.isSafeInteger(request.from) || request.from < 0)) throw new NativeMaterialRefusal('Playback start must be a native passage index.');
        const view = await prepare(request.basis), act = await ensureAct(view.document.expression_ref, 'Playing reusable material');
        retainDestination(view,request.basis);
        const raw = await host.worldRequest({operation: 'act_play', act_ref: act.act_ref, actor: ACTOR, material, ...roles, from: request.from,
          expected_revision: view.document.revision, expected_act_revision: act.revision});
        const result = record(raw), passages = result.passages as ActOutcome['passages'], last = passages?.at(-1);
        return performed(raw, 'act_played', {...request.basis,revision:view.document.revision}, act.act_ref, transition({duration: last?.transition?.duration ?? 1.5, easing: last?.transition?.easing}));
      });
    },
    async inspect(act_ref: string, material_contract?: ActMaterialContract): Promise<WorldAct> {
      const captured=captureReadBasis(host.reading()), route=actReadRequest(act_ref,material_contract);
      const raw=await host.worldRequest(route.request);
      retainReadBasis(captured);
      const act=readNativeActResult(raw,{act_ref,expression_ref:captured.basis.expression_ref,material_contract});
      return act;
    },
    async listActs(): Promise<NativeActList> {
      const captured=captureReadBasis(host.reading());
      const raw=await host.worldRequest({operation:'act_list',expression_ref:captured.basis.expression_ref});
      retainReadBasis(captured);
      return readNativeActList(raw,captured.basis.expression_ref);
    },
    async readEdition(input: {basis:NativeEditorBasis;act_ref:string;expected_act_revision:number;position:number}): Promise<RetainedActEdition> {
      const request=structuredClone(input),captured=captureReadBasis(host.reading());
      if(!sameEditorBasis(request.basis,captured.basis)||!Number.isSafeInteger(request.expected_act_revision)||request.expected_act_revision<1||!Number.isSafeInteger(request.position)||request.position<0) throw new NativeMaterialRefusal('Choose an exact native Act revision, passage index and editor basis.');
      actReadRequest(request.act_ref,'oi.expression-act-material/v2');
      const raw=await host.worldRequest({operation:'act_retained_edition',act_ref:request.act_ref,expected_act_revision:request.expected_act_revision,position:request.position});
      retainReadBasis(captured);
      const result=state(raw,'act_retained_edition'),document=record(result.document);
      if(result.material_contract!=='oi.expression-act-material/v2'||result.act_ref!==request.act_ref||result.act_revision!==request.expected_act_revision||result.position!==request.position||document.schema!=='oi.expression/v1'||document.expression_ref!==request.basis.expression_ref||!Number.isSafeInteger(document.revision)) throw new NativeMaterialRefusal('The retained edition does not match its exact native Act, passage and Expression.',raw);
      return result as unknown as RetainedActEdition;
    },
    seek(input: {basis: NativeEditorBasis; act_ref: string; expected_act_revision: number; position: number; material_contract?:ActMaterialContract}): Promise<NativeMaterialReceipt> {
      const request = structuredClone(input);
      return exclusive(async () => {
        if (!Number.isSafeInteger(request.position) || request.position < 0 || !Number.isSafeInteger(request.expected_act_revision) || request.expected_act_revision<1) throw new NativeMaterialRefusal('Choose a native act passage and exact Act revision.');
        const route=actReadRequest(request.act_ref,request.material_contract), view = await prepare(request.basis);
        const act=readNativeActResult(await host.worldRequest(route.request),{act_ref:request.act_ref,expression_ref:view.document.expression_ref,material_contract:request.material_contract});
        if (act.expression_ref !== view.document.expression_ref || act.revision !== request.expected_act_revision) throw new NativeMaterialRefusal('The native act basis changed; inspect it again.');
        retainDestination(view,request.basis);
        const fade = act.sequence[request.position]?.transition;
        return performed(await host.worldRequest({operation: 'act_seek', act_ref: act.act_ref, actor: ACTOR, position: request.position,
          expected_revision: view.document.revision, expected_act_revision: act.revision}), 'act_sought', {...request.basis,revision:view.document.revision}, act.act_ref,
          fade ? transition({duration: fade.duration ?? 1.5, easing: fade.easing}) : undefined);
      });
    },
    gesture(input: {basis: NativeEditorBasis; act_ref: string; expected_act_revision: number; gesture: string; role?: string; entity_ref?: string; material?: MaterialPerformance['material']}): Promise<NativeMaterialReceipt> {
      const request = structuredClone(input);
      return exclusive(async () => {
        const view = await prepare(request.basis), act = readAct(state(await host.worldRequest({operation: 'act_inspect', act_ref: request.act_ref}), 'act').act);
        if (act.expression_ref !== view.document.expression_ref || act.revision !== request.expected_act_revision) throw new NativeMaterialRefusal('The native act basis changed; inspect it again.');
        retainDestination(view,request.basis);
        return performed(await host.worldRequest({operation: 'act_gesture', act_ref: act.act_ref, actor: ACTOR, gesture: request.gesture,
          role: request.role, entity_ref: request.entity_ref, ...(request.material ? {material: selection(request.material)} : {}),
          expected_revision: view.document.revision, expected_act_revision: act.revision}), 'act_performed', {...request.basis,revision:view.document.revision}, act.act_ref);
      });
    },
    saveReusable(input: {basis: NativeEditorBasis; form: ReuseForm}): Promise<SavedNativeMaterial> {
      const request = structuredClone(input);
      return exclusive(async () => {
        if (!REUSE_KINDS.includes(request.form.kind)) throw new NativeMaterialRefusal('Choose an admitted native material kind.');
        const view = await prepare(request.basis);
        const reuse = buildReuse(host.journey(), request.form, {scene: id => view.bindings[id]?.scene_ref,
          entity: (sceneId, entityId) => view.bindings[sceneId]?.occurrences.find(value => value.view_entity_id === entityId)?.entity_ref});
        const listed = state(await host.worldRequest({operation: 'material_list', kind: request.form.kind}), 'materials') as unknown as MaterialListResult;
        const parent = listed.folders[request.form.kind];
        if (!parent) throw new NativeMaterialRefusal('The material register folder is unavailable.', listed);
        // Verify source still exact after register lookup, before the first write.
        const now = host.reading();
        if (now.basis.expression_ref !== view.document.expression_ref || now.basis.revision !== view.document.revision || now.basis.authored_revision !== request.basis.authored_revision || now.standing.dirty || now.standing.pending) throw new NativeMaterialRefusal('The source changed before it could be copied.');
        const source = view.document.expression_ref, copy_ref = materialExpressionRef(request.form.title, crypto.randomUUID());
        try {
          const forked = state(await host.expressionRequest({operation: 'fork', expression_ref: source, expected_revision: view.document.revision, new_expression_ref: copy_ref, actor: ACTOR}), 'ready') as ExpressionResult;
          if (!forked.document || forked.document.expression_ref !== copy_ref || !Number.isSafeInteger(forked.document.revision)) throw new NativeMaterialRefusal('The fork returned no matching native document.', forked);
          const marked = state(await host.expressionRequest({operation: 'edit', expression_ref: copy_ref, expected_revision: forked.document.revision, actor: ACTOR,
            changes: [{change: 'reuse_set', reuse: remapReuse(reuse, source, copy_ref)}]}), 'ready') as ExpressionResult;
          if (!marked.document || marked.document.expression_ref !== copy_ref || !Number.isSafeInteger(marked.document.revision) || marked.document.revision < forked.document.revision) throw new NativeMaterialRefusal('The reusable copy returned no matching native document.', marked);
          const outcome = state(await host.expressionRequest({operation: 'save_as', expression_ref: copy_ref, expected_revision: marked.document.revision, parent,
            name: materialFileName(request.form.title), operation_ref: `operation:reusable:${crypto.randomUUID()}`, actor: ACTOR, actor_kind: 'human'}), 'saved') as ExpressionResult;
          if (!outcome.file?.location || typeof outcome.file.revision !== 'string' || !outcome.file.revision || (outcome.document && outcome.document.expression_ref !== copy_ref)) throw new NativeMaterialRefusal('The saved receipt does not identify the native material file.', outcome);
          const closed = await host.expressionRequest({operation: 'close', expression_ref: copy_ref, actor: ACTOR}).catch(() => null);
          const closeState = closed && typeof closed === 'object' && !Array.isArray(closed) ? (closed as Record<string, unknown>).state : undefined;
          return {outcome, copy_ref, ...(closeState === 'closed' ? {} : {open_copy_ref: copy_ref})};
        } catch (error) {
          throw new NativeMaterialRefusal(`${error instanceof Error ? error.message : String(error)} Inspect ${copy_ref} before retrying; its copy or save may already exist.`, error instanceof NativeMaterialRefusal ? error.outcome : undefined, copy_ref);
        }
      });
    },
  };
}
