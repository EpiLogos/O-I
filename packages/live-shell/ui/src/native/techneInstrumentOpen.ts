import type {ExpressionsHost, HostedTechneLens} from '@epilogos/expressions-boundary';
import {isDeepInstrument, boundedText} from '@epilogos/expressions-boundary';
import {sameEditorBasis, type NativeEditorReading, type NativeEditorBasis} from '@epilogos/expressions-boundary/editor';

export const TECHNE_INSTRUMENT_OPEN = 'oi:expression-open-instrument';
export interface TechneInstrumentScope {
  workspaceId: string; accessEpoch: number; accessReady: boolean;
  nativeAccessCurrent: (epoch: number) => boolean;
  mode: 'audio' | 'expressions' | 'techne'; editorReading: NativeEditorReading | null;
}
export interface TechneInstrumentOpen {
  workspace_id: string; access_epoch: number; binding_id: string;
  basis: NativeEditorBasis; selection: NativeEditorReading['selection'];
  lens: HostedTechneLens;
}
/** Presentation only. The retained owner keeps the document, cameras,
 * filters and its instrument models. A posted command is never a save ACK. */
export function captureTechneInstrumentOpen(scope: TechneInstrumentScope, lens: HostedTechneLens, bindingId = 'world.expressions'): TechneInstrumentOpen {
  const reading = scope.editorReading;
  if (!scope.accessReady || !scope.nativeAccessCurrent(scope.accessEpoch) || scope.mode === 'audio' || !reading || reading.standing.pending)
    throw Error('Open an available native Expression before choosing its instrument');
  return validateTechneInstrumentOpen({workspace_id: scope.workspaceId, access_epoch: scope.accessEpoch, binding_id: bindingId,
    basis: {...reading.basis}, selection: structuredClone(reading.selection), lens});
}
export function validateTechneInstrumentOpen(raw: unknown): TechneInstrumentOpen {
  const input = raw as TechneInstrumentOpen | null;
  if (!input || !boundedText(input.workspace_id) || !boundedText(input.binding_id) || !Number.isSafeInteger(input.access_epoch) || input.access_epoch < 0 || !isDeepInstrument(input.lens))
    throw Error('Choose a disclosed native instrument and current workspace');
  const basis = input.basis, selection = input.selection;
  if (!basis || !boundedText(basis.expression_ref) || !basis.expression_ref.startsWith('expression:') || !boundedText(basis.scene_ref)
    || !Number.isSafeInteger(basis.revision) || basis.revision <= 0 || !Number.isSafeInteger(basis.authored_revision) || basis.authored_revision < 0
    || !selection || !Array.isArray(selection.entity_ids) || selection.entity_ids.length > 10000
    || !selection.entity_ids.every(id => boundedText(id)) || new Set(selection.entity_ids).size !== selection.entity_ids.length
    || selection.step_id !== null && !boundedText(selection.step_id)) throw Error('The instrument needs an exact native Scene and selection basis');
  return {workspace_id: input.workspace_id, access_epoch: input.access_epoch, binding_id: input.binding_id,
    basis: {...basis}, selection: {entity_ids: [...selection.entity_ids], step_id: selection.step_id}, lens: input.lens};
}
export function currentTechneInstrumentOpen(input: TechneInstrumentOpen, scope: TechneInstrumentScope): boolean {
  const reading = scope.editorReading;
  return scope.workspaceId === input.workspace_id && scope.accessEpoch === input.access_epoch && scope.accessReady
    && scope.nativeAccessCurrent(input.access_epoch) && scope.mode !== 'audio' && !!reading && !reading.standing.pending
    && sameEditorBasis(input.basis, reading.basis) && JSON.stringify(input.selection) === JSON.stringify(reading.selection);
}
export interface TechneInstrumentReceiver {
  host: ExpressionsHost; current: () => TechneInstrumentScope; isPresented: () => boolean;
}
/** Validate again at the actual host, before sending to the existing lens
 * controller. This never opens another document or silently rebases a draft. */
export function openRetainedTechneInstrument(receiver: TechneInstrumentReceiver, raw: unknown): {state: 'requested'; lens: HostedTechneLens} {
  const input = validateTechneInstrumentOpen(raw), scope = receiver.current();
  if (!currentTechneInstrumentOpen(input, scope)) throw Error('The native source or selection changed before opening the instrument');
  if (!receiver.isPresented() || !receiver.host.isReady() || receiver.host.bindingId !== input.binding_id) throw Error('This instrument belongs to an unavailable application presentation');
  const scene = receiver.host.getState()?.nativeScene;
  if (!scene || scene.expression_ref !== input.basis.expression_ref || scene.scene_ref !== input.basis.scene_ref || scene.revision !== input.basis.revision)
    throw Error('The retained application has not adopted this exact native Scene');
  receiver.host.selectInstrument(input.lens);
  return {state: 'requested', lens: input.lens};
}
export interface TechneInstrumentEvent extends TechneInstrumentOpen {
  handled?: boolean;
  complete?: (result: {state: 'requested'; lens: HostedTechneLens} | {state: 'refused'; reason: string}) => void;
}
export function connectTechneInstrumentRequests(receiver: TechneInstrumentReceiver, events: EventTarget = window): () => void {
  const open = (event: Event) => {
    const detail = (event as CustomEvent<TechneInstrumentEvent>).detail;
    if (!detail || detail.handled) return;
    if (detail.binding_id !== receiver.host.bindingId || detail.workspace_id !== receiver.current().workspaceId) return;
    detail.handled = true;
    try {const result=openRetainedTechneInstrument(receiver, detail);detail.complete?.(result);}
    catch (error) {detail.complete?.({state:'refused',reason:error instanceof Error ? error.message : String(error)});}
  };
  events.addEventListener(TECHNE_INSTRUMENT_OPEN, open);
  return () => events.removeEventListener(TECHNE_INSTRUMENT_OPEN, open);
}
