import {Journey,clone,uid} from './model';
import {captureObjectState,initialiseSources,stateSource} from './sourceState';
export function foldObjectState(j:Journey,fromSceneId:string,objectId:string,stepIndex:number,toSceneId:string,targetId:string,mode:'seconds'|'morph'|'manual',removeSource=false){
 const from=j.scenes.find(s=>s.id===fromSceneId),to=j.scenes.find(s=>s.id===toSceneId);
 if(!from||!to||j.scenes.indexOf(to)>=j.scenes.indexOf(from))throw new Error('Choose an earlier scene.');
 const source=from.entities.find(e=>e.id===objectId),target=to.entities.find(e=>e.id===targetId);
 if(!source||!target||source.kind!=='formation'||target.kind!=='formation')throw new Error('Choose a formation in each scene.');
 if(target.locked)throw new Error('Unlock the destination formation first.');
 if(target.sequence.steps.length>=32)throw new Error('A formation holds up to 32 states.');
 initialiseSources({...j,scenes:[from,to],savedScenes:{}});
 // Copy the chosen authored state, including its source and spatial/visual envelope.
 // Scene-wide physics and automation remain owned by their scene.
 const chosen=source.sequence.steps[stepIndex],state=captureObjectState(source);
 if(chosen){Object.assign(state,clone(chosen));state.objectState=clone(chosen.objectState??captureObjectState(source).objectState);state.source=stateSource(source,stepIndex)?clone(stateSource(source,stepIndex)):undefined;}
 state.id=uid('step');state.name=chosen?.name??(state.source?.kind==='image'?state.source.image.name:undefined)??source.name;
 state.position={x:source.position.x-target.position.x+(chosen?.position?.x??0),y:source.position.y-target.position.y+(chosen?.position?.y??0),z:source.position.z-target.position.z+(chosen?.position?.z??0)};
 state.holdOverride=true;state.transitionOverride=true;
 if(target.sequence.steps.length===1&&!target.sequence.steps[0].objectState)target.sequence.steps[0].objectState=captureObjectState(target).objectState;
 target.sequence.steps.push(state);target.sequence.manual=mode==='manual';target.sequence.enabled=mode!=='manual';target.sequence.clock=mode==='morph'?'morph':'seconds';if(mode==='manual'){to.engine.autoOscillate=false;to.engine.morphEnabled=true;}
 if(removeSource){j.scenes=j.scenes.filter(s=>s!==from);if(j.savedScenes)delete j.savedScenes[from.id];}
 return {sceneId:to.id,entityId:target.id,stepIndex:target.sequence.steps.length-1};
}
