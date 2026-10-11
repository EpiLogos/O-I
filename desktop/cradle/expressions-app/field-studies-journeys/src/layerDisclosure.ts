/** Presentation continuity only: a different artwork/state starts closed. */
export interface LayerDisclosure {journey:string;scene:string;entity:string;step:string;open:boolean}
export function readLayerDisclosure(element:HTMLDetailsElement|null):LayerDisclosure|null {
 if(!element)return null;
 const {layerJourney:journey,layerScene:scene,entityId:entity,layerState:step}=element.dataset;
 if(!journey||!scene||!entity||!step)return null;
 return {journey,scene,entity,step,open:element.open};
}
export function restoreLayerDisclosure(element:HTMLDetailsElement|null,prior:LayerDisclosure|null):boolean {
 const current=readLayerDisclosure(element);
 if(!element||!prior||!current||current.journey!==prior.journey||current.scene!==prior.scene||current.entity!==prior.entity||current.step!==prior.step)return false;
 element.open=prior.open;return true;
}
