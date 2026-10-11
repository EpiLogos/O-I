import type {Journey} from './model.js';
import type {KernelConversion} from './kernelDocumentBridge.js';
import {prepareCompositionEdit} from './kernelComposition.js';

/** Compare both drafts against the same native basis. This includes native
 * fields and dirty recovered material, without treating newer raw metadata
 * alone as a second authored gesture. A changed native body retires old
 * full-document history instead of letting it overwrite incoming work. */
export function nativeAdoptionHistory(view:KernelConversion,current:Journey):'preserve'|'retire'{
 if(current.id!==view.journey.id)return 'retire';
 try{
  const before=prepareCompositionEdit(view,current).changes;
  const incoming=prepareCompositionEdit(view,view.journey).changes;
  return JSON.stringify(before)===JSON.stringify(incoming)?'preserve':'retire';
 }catch{return 'retire';}
}
