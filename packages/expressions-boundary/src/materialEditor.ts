import {sameEditorBasis, type NativeEditorBasis} from './editor';
import type {ActMaterialContract, createNativeMaterialController, NativeActList, NativeMaterialReceipt, RetainedActEdition, SavedNativeMaterial, WorldAct} from './nativeMaterials';

type Controller = ReturnType<typeof createNativeMaterialController>;
type Input<K extends keyof Controller> = Parameters<Controller[K]>[0];
export type NativeMaterialEditorRequest = {operation: 'material'; basis: NativeEditorBasis} & (
  | {action: 'perform'; input: Omit<Input<'perform'>, 'basis'>}
  | {action: 'play'; input: Omit<Input<'play'>, 'basis'>}
  | {action: 'seek'; input: Omit<Input<'seek'>, 'basis'>}
  | {action: 'gesture'; input: Omit<Input<'gesture'>, 'basis'>}
  | {action: 'save-reusable'; input: Omit<Input<'saveReusable'>, 'basis'>}
  | {action: 'list-acts'}
  | {action: 'inspect'; act_ref: string; material_contract?:ActMaterialContract}
  | {action: 'read-edition'; input:Omit<Input<'readEdition'>,'basis'>}
);
export type NativeMaterialEditorResult =
  | {kind: 'performed'; receipt: NativeMaterialReceipt}
  | {kind: 'saved'; receipt: SavedNativeMaterial}
  | {kind: 'acts'; reading: NativeActList}
  | {kind: 'act'; reading: WorldAct}
  | {kind: 'edition'; reading:RetainedActEdition};

/** Routes the shell gesture to the retained application's existing owners.
 * The wire contains an exact editor basis, never an owner URL or document. */
export async function requestNativeMaterialEditor(controller: Controller, request: NativeMaterialEditorRequest, basis: () => NativeEditorBasis): Promise<NativeMaterialEditorResult> {
  if (!sameEditorBasis(request.basis, basis())) throw Error('The material destination changed; retain the choice and refresh its native basis');
  switch (request.action) {
    case 'perform': return {kind: 'performed', receipt: await controller.perform({...request.input, basis: request.basis})};
    case 'play': return {kind: 'performed', receipt: await controller.play({...request.input, basis: request.basis})};
    case 'seek': return {kind: 'performed', receipt: await controller.seek({...request.input, basis: request.basis})};
    case 'gesture': return {kind: 'performed', receipt: await controller.gesture({...request.input, basis: request.basis})};
    case 'save-reusable': return {kind: 'saved', receipt: await controller.saveReusable({...request.input, basis: request.basis})};
    case 'list-acts': return {kind: 'acts', reading: await controller.listActs()};
    case 'inspect': return {kind: 'act', reading: await controller.inspect(request.act_ref,request.material_contract)};
    case 'read-edition': return {kind:'edition',reading:await controller.readEdition({...request.input,basis:request.basis})};
    default: throw Error('Unsupported native material action');
  }
}
