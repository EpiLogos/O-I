import {stateLabel,stateSource} from './sourceState';
import type {Entity} from './model';

export type BeltEntry = {id:string;key:string;scope:'field'|'selected'|'named';entityId?:string;sceneId?:string;journeyId?:string};
export interface WorkspacePreferences {version:1;appearance:'scene'|'dark'|'light';entries:BeltEntry[]}
export const WORKSPACE_KEY='oi.workspace.v1';
export function defaultWorkspace():WorkspacePreferences{return {version:1,appearance:'scene',entries:[
 {id:'speed',scope:'field',key:'timeScale'}, {id:'spring',scope:'field',key:'recovery'},
 {id:'viscosity',scope:'field',key:'native_fluid__viscosity'}, {id:'flow',scope:'field',key:'turbulence'},
 {id:'transition',scope:'selected',key:'sequence.transition'}, {id:'blend',scope:'field',key:'native_morphProgress'},
]};}
export function validateWorkspace(value:unknown):WorkspacePreferences {
 const v=value as WorkspacePreferences;
 if(!v||v.version!==1||!['scene','dark','light'].includes(v.appearance)||!Array.isArray(v.entries))throw new Error('Unsupported workspace preferences');
 const ids=new Set<string>();
 for(const e of v.entries){if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.key!=='string'||!['field','selected','named'].includes(e.scope)||e.scope==='named'&&[e.entityId,e.sceneId,e.journeyId].some(x=>typeof x!=='string'||!x))throw new Error('Invalid toolbelt binding');ids.add(e.id);}
 return structuredClone(v);
}
export function moveBeltEntry(entries:BeltEntry[],id:string,offset:number){const i=entries.findIndex(e=>e.id===id),j=i+offset;if(i<0||j<0||j>=entries.length)return false;[entries[i],entries[j]]=[entries[j],entries[i]];return true;}
export function formationSummary(e:Entity):string {
 const label=(s:{shape:string;text:string})=>s.shape==='text'?s.text:s.shape;
 const states=e.sequence.steps;
 if(states.length>1)return states.map((s,i)=>stateLabel({...s,source:stateSource(e,i)})).join(e.sequence.enabled?' → ':' ↔ ')+(e.sequence.enabled?' · playing':e.sequence.manual?' · manual':' · held');
 return (states[0]?stateLabel({...states[0],source:stateSource(e,0)}):label(e))+' · single state';
}

/** Editing a held target must reach the native base geometry as well as its link. */
export function syncHeldState(e:Entity,index:number){
 const step=e.sequence.steps[index];if(!step||e.sequence.enabled||e.sequence.manual)return;
 e.source=step.source?structuredClone(step.source):undefined;if(step.objectState)Object.assign(e,structuredClone(step.objectState));e.shape=step.shape;e.text=step.text;e.yantraId=step.yantraId;e.templateFrequency=step.templateFrequency;
 e.templateGeometry=step.templateGeometry;e.templateDimension=step.templateDimension;
}
