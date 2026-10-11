import type {KnowledgeAddress} from '../../../../../desktop/cradle/src/kernel/types';
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types';
import {validateNativeKnowledgeContext, type NativeKnowledgeContext} from '../../../../../desktop/cradle/src/knowledge/nativeFocus';
import type {NativeEditorReading} from '@epilogos/expressions-boundary/editor';
import type {KernelExpressionDocument} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';

export interface KnowledgeOpenInput extends NativeKnowledgeContext {
  title: string;
  project?: string;
  address?: KnowledgeAddress;
  /** Existing explicit Wiki event; never derived from a file location. */
  ref?: string;
  plane?: 'graph' | 'page';
  complete?: (error?: string) => void;
}
export type KnowledgeBinding = SurfaceBinding & {view: NonNullable<SurfaceBinding['view']> & {nativeKnowledge?: NativeKnowledgeContext}};
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 4096;
export function validateKnowledgeOpen(raw: unknown): KnowledgeOpenInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('A native Knowledge open is required');
  const input = raw as KnowledgeOpenInput;
  if (!text(input.title) || input.project !== undefined && !text(input.project) || input.ref !== undefined && !text(input.ref) || input.plane !== undefined && input.plane !== 'graph' && input.plane !== 'page' || input.complete !== undefined && typeof input.complete !== 'function') throw Error('Invalid Knowledge presentation request');
  const context = Object.fromEntries(['subject_ref','native_owner','register','origin','source_basis','returnTo'].filter(key => (input as unknown as Record<string, unknown>)[key] !== undefined).map(key => [key,(input as unknown as Record<string, unknown>)[key]]));
  const native = validateNativeKnowledgeContext(context);
  if (!native) throw Error('Invalid native subject or retained Canvas Return');
  if (input.address && (!['wiki','source','project-map'].includes(input.address.kind) || !text(input.address.value))) throw Error('Use the disclosed native Knowledge address');
  if (native.origin === 'canvas' && (!native.subject_ref || input.plane === 'page' && !input.address)) throw Error('Canvas source pages require an explicit native address');
  const address = input.address ?? (input.ref && !native.subject_ref ? {kind: 'wiki' as const, value: input.ref} : undefined);
  if (!address && !native.subject_ref) throw Error('No disclosed native Knowledge destination was supplied');
  const plane = input.plane ?? (address?.kind === 'source' ? 'page' : 'graph');
  if (plane === 'page' && !address) throw Error('Source reading requires its exact native address');
  return {title: input.title, ...(input.project ? {project: input.project} : {}), ...(address ? {address} : {}), plane, ...native, ...(input.complete ? {complete: input.complete} : {})};
}
export function createKnowledgeBinding(raw: unknown, id: string): KnowledgeBinding {
  const input = validateKnowledgeOpen(raw);
  if (!text(id)) throw Error('A presentation binding ID is required');
  const {title, project, address, plane, complete: _complete, ref: _ref, ...nativeKnowledge} = input;
  return {id, kind: 'knowledge', title, ...(project ? {project} : {}), ...(address ? {address, ref: address.value} : {ref: input.subject_ref}), view: {knowledgePlane: plane, ...(Object.keys(nativeKnowledge).length ? {nativeKnowledge} : {})}};
}
export function sameKnowledgeDestination(binding: SurfaceBinding, target: KnowledgeBinding): boolean {
  return binding.kind === 'knowledge' && binding.ref === target.ref && binding.project === target.project && binding.address?.kind === target.address?.kind && binding.view?.knowledgePlane === target.view.knowledgePlane && JSON.stringify((binding as KnowledgeBinding).view?.nativeKnowledge ?? null) === JSON.stringify(target.view.nativeKnowledge ?? null);
}
/** Capture only a subject disclosed by this exact native document and the
 * currently selected owner occurrence. Authoring history and native document
 * revision are distinct; only the native document revision qualifies this read. */
export function createCanvasKnowledgeOpen(document: KernelExpressionDocument, editor: NativeEditorReading, mode: 'expressions' | 'techne'): KnowledgeOpenInput {
  const basis=editor.basis;
  if(document.expression_ref!==basis.expression_ref||document.revision!==basis.revision)throw Error('The native subject reading belongs to another Expression or revision');
  const scene=document.scenes.find(value=>value.scene_ref===basis.scene_ref);
  if(!scene)throw Error('The current Canvas Scene is absent from the native subject reading');
  if(editor.selection.entity_ids.length>10000)throw Error('The native Canvas selection is too large');
  const selection=editor.selection.entity_ids.map(id=>{
    const reference=editor.entityOccurrences[id];
    if(!text(reference)||!scene.entity_refs.includes(reference)||!document.entities[reference])throw Error('A selected occurrence is absent from this exact native Scene');
    return reference;
  });
  if(selection.length>1)throw Error('Choose one exact native subject before opening Graph');
  const entity_ref=selection[0]??null;
  const entity=entity_ref?document.entities[entity_ref]:undefined;
  const subject=entity?.subject??(!entity_ref?scene.body:undefined);
  if(!subject||!text(subject.subject_ref)||!text(subject.native_owner))throw Error('This Canvas occurrence has no disclosed native subject and owner');
  return validateKnowledgeOpen({title:entity?.title??scene.title,plane:'graph',subject_ref:subject.subject_ref,native_owner:subject.native_owner,origin:'canvas',
    source_basis:{expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref,entity_ref},
    returnTo:{bindingId:'world.expressions',expression_ref:document.expression_ref,scene_ref:scene.scene_ref,mode,selection,step_id:editor.selection.step_id}});
}
