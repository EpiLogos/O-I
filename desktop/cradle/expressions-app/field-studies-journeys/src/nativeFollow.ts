/** Following a kernel Expression another owner is changing (a Factory Run's
 * act, a host `open-expression`, the boot `?expression=` deep link).
 *
 * Pure decisions, no DOM and no owner calls, so the laws are testable:
 *  - an opened native Expression is what the frame stands on: the entry gate
 *    closes and the engine presents the document's current Scene;
 *  - a refresh with no local edits re-reads the kernel document and never
 *    commits; a refresh with local edits keeps them as unsaved work and
 *    discloses the newer revision instead of committing blindly;
 *  - an Expression a running act performs is followed read-through: the
 *    frame never commits into it. */

export type RefreshStep =
 | {kind:'follow'}            // not standing on this ref: open it read-through
 | {kind:'current'}           // already on the kernel's revision: nothing to do
 | {kind:'adopt'}             // clean: take the kernel's newer revision
 | {kind:'disclose';localRevision:number;kernelRevision:number}; // edited: keep the edits, say what moved

export function refreshStep(input:{openRef?:string|null;reference:string;localRevision?:number;kernelRevision:number;edited:boolean;pending:boolean}):RefreshStep{
 if(!input.openRef||input.openRef!==input.reference||input.localRevision===undefined)return {kind:'follow'};
 if(input.kernelRevision<=input.localRevision)return {kind:'current'};
 if(input.edited||input.pending)return {kind:'disclose',localRevision:input.localRevision,kernelRevision:input.kernelRevision};
 return {kind:'adopt'};
}

/** Local edits are both a store change since the native view was loaded and
 * a real composition difference (conversion bookkeeping is not an edit). */
export function hasLocalEdits(versionAtLoad:number,version:number,compositionChanges:number):boolean{
 return version!==versionAtLoad&&compositionChanges>0;
}

/** Whether a running (or held) act performs this Expression. */
export function performedByLiveAct(acts:readonly {expression_ref?:unknown;phase?:unknown}[],reference:string):boolean{
 return acts.some(a=>a.expression_ref===reference&&(a.phase==='running'||a.phase==='held'));
}

/** A distinct recovery identity for unsaved work set aside when the frame is
 * moved onto a followed Expression (nothing is discarded). */
export function retainedDraftId(id:string,stamp:number):string{
 const base=id.replace(/[^a-zA-Z0-9_.:-]/g,'-').slice(0,120)||'draft';
 return `${base}.unsaved-${Math.max(0,Math.floor(stamp))}`;
}

/** What presenting an adopted native view means for the frame. */
export function presentAdoption(view:{startSceneId:string|null;journey:{scenes:readonly {id:string}[]}}):{closeEntryGate:true;sceneId:string}{
 const sceneId=view.startSceneId&&view.journey.scenes.some(s=>s.id===view.startSceneId)?view.startSceneId:view.journey.scenes[0]?.id;
 if(!sceneId)throw new Error('The opened Expression has no Scene to present');
 return {closeEntryGate:true,sceneId};
}

/** Authoring panels while following: an act-performed (read-through)
 * Expression is watched, not edited — no editing panel opens over it. */
export function followedPanels(readThrough:boolean):{sequence:boolean|null;inspector:boolean|null}{
 return readThrough?{sequence:false,inspector:false}:{sequence:null,inspector:null};
}
