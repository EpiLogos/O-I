import type {KernelConversion} from './kernelDocumentBridge';
import type {PalaceDocumentSnapshot,PalaceRegionSpec} from '../../../src/techne/m0m5/palace/composition';
export interface PalaceInstrumentBasis {expression_ref:string;revision:number;scene_id:string;scene_ref:string}
export function palaceInstrumentBasis(view:KernelConversion|undefined,sceneId:string):PalaceInstrumentBasis {
 const scene=view?.bindings[sceneId];
 if(!view||!scene)throw Error('Open a native Scene before entering the Palace');
 return {expression_ref:view.document.expression_ref,revision:view.document.revision,scene_id:sceneId,scene_ref:scene.scene_ref};
}
export function samePalaceInstrumentBasis(basis:PalaceInstrumentBasis,view:KernelConversion|undefined,sceneId:string):boolean {
 try{const now=palaceInstrumentBasis(view,sceneId);return Object.keys(basis).every(key=>basis[key as keyof PalaceInstrumentBasis]===now[key as keyof PalaceInstrumentBasis]);}catch{return false;}
}
export function assertPalaceSource(doc:PalaceDocumentSnapshot,basis:PalaceInstrumentBasis):void {
 if(!doc||doc.expression_ref!==basis.expression_ref||doc.revision!==basis.revision||!Array.isArray(doc.scenes)
   ||!doc.scenes.some(scene=>scene.scene_ref===basis.scene_ref)||new Set(doc.scenes.map(scene=>scene.scene_ref)).size!==doc.scenes.length)
  throw Error('The Palace reading belongs to another native source, revision or Scene');
}
export function samePalaceComposition(proposed:readonly PalaceRegionSpec[],readback:readonly PalaceRegionSpec[]):boolean {
 return readback.length===proposed.length&&readback.every((region,index)=>region.name===proposed[index].name&&(region.member?.expression_ref??null)===(proposed[index].member?.expression_ref??null));
}
