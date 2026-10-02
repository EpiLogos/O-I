import {type Entity, type SequenceStep, uid} from './model';
import {capturedStepState, refitStepForGlyph, refitStepForSource, type FontRef} from './stateSizing';
import {setStateSource, preserveLayerStates} from './sourceState';

/** Every added mark is a state of the existing formation, with its own fitted box. */
export function appendFormationState(e:Entity, text:string, source:Entity['source'], font:FontRef, autoFit=true):number {
 if(e.kind!=='formation'||e.locked)throw new Error('Choose an unlocked formation.');
 if(e.sequence.steps.length>=32)throw new Error('A formation holds up to 32 states.');
 preserveLayerStates(e);
 // Preserve the original state before a held-state edit changes the entity's base appearance.
 for(let i=0;i<e.sequence.steps.length;i++)e.sequence.steps[i].objectState??=capturedStepState(e,i);
 const index=e.sequence.steps.length;
 const step:SequenceStep={id:uid('step'),text,shape:'text',layers:[],hold:e.sequence.hold??3,transition:e.sequence.transition??1,position:null};
 e.sequence.steps.push(step);
 setStateSource(e,index,source);
 if(autoFit){if(source)refitStepForSource(e,index);else refitStepForGlyph(e,index,text,font);}
 return index;
}
