import {validateReading, type TechneReading} from '../../../src/techne/contract';
import {beats, type JourneyBeat, type JourneyModel} from '../../../src/techne/m0m5/journey/beats';
import type {KernelConversion} from './kernelDocumentBridge';
import {assertInstrumentReadingScope} from './researchInstrumentsData';

export interface JourneyInstrumentBasis {expression_ref:string;revision:number;scene_ref:string}
export function journeyInstrumentBasis(view:KernelConversion|undefined,sceneId:string):JourneyInstrumentBasis {
 const binding=view?.bindings[sceneId];
 if(!view||!binding)throw Error('Open a native Scene before entering Journey');
 return {expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref};
}
export function sameJourneyInstrumentBasis(basis:JourneyInstrumentBasis,view:KernelConversion|undefined,sceneId:string):boolean {
 try{const current=journeyInstrumentBasis(view,sceneId);return current.expression_ref===basis.expression_ref&&current.revision===basis.revision&&current.scene_ref===basis.scene_ref;}catch{return false;}
}
export function readJourneyInstrument(raw:unknown,view:KernelConversion,sceneId:string):{reading:TechneReading;model:JourneyModel} {
 const validation=validateReading(raw);
 if(!validation.valid)throw Error(`The native Journey reading is invalid: ${validation.errors.join('; ')}`);
 assertInstrumentReadingScope(raw,view,sceneId);
 const reading=raw as TechneReading;
 return {reading,model:beats(reading)};
}
export interface JourneyBeatFocus extends JourneyInstrumentBasis {target_scene_ref:string}
/** A disclosed foreign Expression is visible as a beat but is never
 * selected through the current document's Scene focus operation. */
export function prepareJourneyBeatFocus(beat:JourneyBeat,basis:JourneyInstrumentBasis,view:KernelConversion|undefined,sceneId:string):JourneyBeatFocus {
 if(!sameJourneyInstrumentBasis(basis,view,sceneId))throw Error('The native Journey source changed; refresh before opening its beat');
 if(beat.expression_ref!==basis.expression_ref)throw Error('This beat belongs to another bound Expression; open that native work first');
 if(beat.revision!==String(basis.revision))throw Error('This beat was disclosed at another native revision; refresh its reading');
 if(!view!.document.scenes.some(scene=>scene.scene_ref===beat.scene_ref))throw Error('The disclosed beat Scene is absent from the current native Expression');
 return {...basis,target_scene_ref:beat.scene_ref};
}
