import type {SourceOccurrenceChoice} from './nativeOccurrence.js';
import type {BlueprintIntent} from './nativeBlueprint.js';
/** Working controls for the actual hosted application. The browser gallery
 * remains useful for drafts; the native Library, files and mutations remain
 * owned by the cradle. Neither opening this panel nor inspecting a file
 * publishes material or starts an Agent. */
import {clone,type Journey} from './model.js';
import {esc} from './icons.js';
import {NativeWorking,type NativeFile,type WorkingSnapshot} from './nativeWorking.js';
import {kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,nativeExpressionRequest,nativeFileRequest} from './kernelExpressions.js';
import {readWorkingCheckpoint,readWorkingDraft,writeWorkingCheckpoint,writeDraft} from './recovery.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {nativeConnections} from './nativeCorrespondence.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {prepareCompositionEdit} from './kernelComposition.js';
import {NativeOpenIntent} from './nativeOpenIntent.js';
import {NativeSelectionQueue} from './nativeSelectionQueue.js';

/** The exact native work a summon carries to the cradle's verso account —
 * refs only, the pointer to the Expression / Scene / entity-or-relation
 * occurrence currently open. The cradle validates it through the owner. */
export interface NativeSubject {
 ref:string;kind:'expression';nativeOwner:'oi';revision:number;title:string;
 project?:string;sceneRef:string|null;entityRef:string|null;relationRef:string|null;
}
/** The current native construction's real facets, derived from the open kernel
 * Expression — what each M′ instrument stands on, so a lens's availability and
 * content are DISCLOSED by the actual construction, never hardcoded. Null when
 * no native construction is open. */
export interface ConstructionFacets {
 ref:string;revision:number;title:string;
 members:number;relations:number;
 scenes:{scene_ref:string;title:string;members:number;relations:number}[];
 currentScene:string|null;
}
export interface NativeWorkspaceHost {
 shouldRetainDraft?:()=>boolean;
 snapshot:()=>WorkingSnapshot;
 version:()=>number;
 load:(view:KernelConversion,preservePosition?:boolean)=>void;
 toast:(message:string,duration?:number)=>void;
 summon:(kind:'library'|'verso'|'search',subject?:NativeSubject)=>void;
 correspondence:(rows:Record<string,ConnectionBinding[]>,selection:string|null)=>void;
}
/** Capture the visible draft and navigation generation before any owner read.
 * A native reply may be retained, but only this still-current draft may adopt it. */
export function captureNativeAdoption(host:Pick<NativeWorkspaceHost,'snapshot'|'version'>,generation:()=>number):()=>boolean {
 const version=host.version(),draftId=host.snapshot().journey.id,selected=generation();
 return ()=>host.version()===version&&host.snapshot().journey.id===draftId&&generation()===selected;
}
export function installNativeWorkspace(host:NativeWorkspaceHost){
 const scope=new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
 const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
  checkpoint:(id,value)=>writeWorkingCheckpoint(id,value,scope),mint:()=>`expression:authored-${crypto.randomUUID()}`});
 const panel=document.createElement('aside');panel.id='native-work';panel.className='native-work hud-panel chrome';panel.hidden=true;panel.setAttribute('aria-label','Native composition');
 panel.innerHTML=`<header><div><span class="panel-kicker">NATIVE COMPOSITION</span><h2>Keep the whole work</h2></div><button type="button" data-native="close" aria-label="Close native composition">×</button></header>
 <p class="native-status" role="status" aria-live="polite"></p><p class="native-basis"></p>
 <details class="native-basis-detail"><summary>Exact reference</summary><p class="native-basis-ref"></p></details>
 <div class="native-actions"><button type="button" class="secondary" data-native="commit">Commit composition</button><button type="button" class="secondary" data-native="retry-open" hidden>Retry opening</button><button type="button" class="secondary" data-native="inspect">Inspect interrupted operation</button><button type="button" class="secondary" data-native="retry">Retry exact file save</button></div>
 <fieldset><legend>Native file</legend><label>Central folder<input data-native-field="folder" value="." placeholder="Central-relative folder"></label><label>Filename<input data-native-field="name" value="expression.json" placeholder="expression.json"></label><button type="button" class="secondary" data-native="save">Save native file</button><p class="native-file"></p><details class="native-file-detail"><summary>Exact location</summary><p class="native-file-path"></p></details></fieldset>
 <fieldset><legend>Continue native work</legend><div class="native-actions"><button type="button" data-native="library">Library</button><button type="button" data-native="verso">Account / sources</button><button type="button" data-native="refresh">Refresh open work</button></div><label>Open native Expression<select data-native-field="expression"><option value="">Choose open work…</option></select></label><button type="button" class="secondary" data-native="open">Open selected work</button><label>Or open an exact native file<input data-native-field="path" placeholder="Project/file.expression.json"></label><button type="button" class="secondary" data-native="open-file">Open file</button></fieldset>
 <section class="native-disclosure"><h3>Field disclosure</h3><p class="native-page"></p><div class="native-actions"><button type="button" data-native="previous">Previous members</button><button type="button" data-native="next">Next members</button></div></section>
 <p class="native-note">Commit updates the native working document. Save writes and independently reads its file. Working-copy backup is private recovery, not file publication.</p>`;
 document.body.appendChild(panel);
 let busy=false,notice='',lastFailure=false,restoreGeneration=0;
 let ownerIdle:Promise<void>=Promise.resolve();
 let queuedMutations=0;
 const field=(name:string)=>panel.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-native-field="${name}"]`)!;
 const status=(text:string)=>{notice=text;panel.querySelector('.native-status')!.textContent=text;};
 const update=()=>{
  const state=work.state,doc=state?.view?.document;
  host.correspondence(nativeConnections(state?.view),doc?.selection?.relation_ref??null);
  // Default face: plain status prose only ("Saved · revision N" — §4, no raw
  // transport strings). The exact expression ref and file path stay
  // available, but behind an explicit "Exact reference"/"Exact location"
  // disclosure rather than on the face every reader sees.
  panel.querySelector('.native-basis')!.textContent=doc?`${doc.title} · Saved · revision ${doc.revision}`:'This authoring draft does not yet have a native identity. Its first commit creates one.';
  panel.querySelector('.native-basis-ref')!.textContent=doc?doc.expression_ref:'No native identity yet.';
  panel.querySelector('.native-file')!.textContent=state?.file?`Saved · revision ${state.file.revision}`:'No verified native file is attached to this working draft.';
  panel.querySelector('.native-file-path')!.textContent=state?.file?state.file.location.path:'No verified native file is attached to this working draft.';
  const pending=state?.pending;
  panel.querySelectorAll<HTMLButtonElement>('[data-native]').forEach(button=>{button.disabled=busy&&!['close','library','verso'].includes(button.dataset.native!);});
  (panel.querySelector('[data-native="retry-open"]') as HTMLButtonElement).hidden=!opens.reference;
  (panel.querySelector('[data-native="inspect"]') as HTMLButtonElement).hidden=!pending;
  (panel.querySelector('[data-native="retry"]') as HTMLButtonElement).hidden=pending?.kind!=='file';
  const binding=state?.view?.bindings[host.snapshot().sceneId];
  panel.querySelector('.native-page')!.textContent=binding?`${binding.occurrences.length} represented of ${binding.member_refs.length} native memberships · page ${binding.page+1}/${binding.page_count}${binding.hidden_refs.length?` · ${binding.hidden_refs.length} deliberately hidden`:''}`:'Open or commit a native composition to inspect its exact occurrences.';
  (panel.querySelector('[data-native="previous"]') as HTMLButtonElement).disabled=busy||!binding||binding.page<=0;
  (panel.querySelector('[data-native="next"]') as HTMLButtonElement).disabled=busy||!binding||binding.page>=binding.page_count-1;
  field('folder').disabled=busy||!!state?.file;field('name').disabled=busy||!!state?.file;
 };
 const run=async(task:()=>Promise<void>):Promise<boolean>=>{
  if(busy)return false;busy=true;
  let releaseOwner!:()=>void;ownerIdle=new Promise<void>(resolve=>{releaseOwner=resolve;});
  lastFailure=false;update();status('Reading or saving through the native owner…');
  try{await task();return true;}catch(error){lastFailure=true;status(error instanceof Error?error.message:String(error));host.toast(notice,7000);return false;}
  finally{busy=false;releaseOwner();update();selections.resume();}
 };
 const mutate=async(task:()=>Promise<void>):Promise<boolean>=>{
  const generation=restoreGeneration,draftId=host.snapshot().journey.id;
  const nativeRef=work.state?.view?.document.expression_ref;
  queuedMutations++;
  try{
   while(busy)await ownerIdle;
   return await run(async()=>{
    if(generation!==restoreGeneration||draftId!==host.snapshot().journey.id||nativeRef!==work.state?.view?.document.expression_ref)throw new Error('The native work changed before its queued edit. Return to that draft before committing.');
    await task();
   });
  }finally{queuedMutations--;selections.resume();}
 };
 type FocusIntent={generation:number;nativeRef:string;sceneId:string;entityId:string|null;bindingRef?:string};
 const selections=new NativeSelectionQueue<FocusIntent>({
  available:()=>!busy&&!work.busy&&queuedMutations===0,
  current:intent=>intent.generation===restoreGeneration&&work.state?.view?.document.expression_ref===intent.nativeRef,
  apply:intent=>run(async()=>{
   const view=work.state?.view,binding=view?.bindings[intent.sceneId];
   if(!view||!binding)throw new Error('This field does not have a native occurrence basis');
   const occurrence=binding.occurrences.find(o=>o.view_entity_id===intent.entityId);
   if(intent.entityId&&!occurrence)throw new Error('The selected representation is not a bound native occurrence');
   await work.select({scene_ref:binding.scene_ref,entity_ref:occurrence?.entity_ref??null,binding_ref:intent.bindingRef});
   if(intent.generation!==restoreGeneration)return;
   const relation=binding.relations.find(r=>r.binding_ref===intent.bindingRef);
   status(relation?`Relation ${relation.relation.ref} · ${relation.relation.revision} · ${relation.from_entity_ref} → ${relation.to_entity_ref}`
    :occurrence?`Selected ${occurrence.subject?.subject_ref??occurrence.entity_ref} · occurrence ${occurrence.entity_ref}`:'Native selection cleared.');
  }),
 });
 const refresh=async()=>{
  if(!kernelExpressionsAvailable())throw new Error('Native operations are unavailable until the desktop host announces its channel. Your browser draft remains available.');
  const selected=field('expression').value,entries=await listKernelExpressions();
  field('expression').innerHTML='<option value="">Choose open work…</option>'+entries.map(entry=>`<option value="${esc(entry.expression_ref)}">${esc(entry.title)} · r${entry.revision}</option>`).join('');
  field('expression').value=selected;status(`${entries.length} native Expressions are open. The Library also discovers saved files and collections.`);
 };
 const retainSubmitted=async(snapshot:WorkingSnapshot)=>{
  const generation=restoreGeneration;
  await writeDraft(snapshot.journey);
  if(generation!==restoreGeneration||host.snapshot().journey.id!==snapshot.journey.id)throw new Error('The selected work changed while its draft was being retained. No composition was committed.');
 };
 const requireAdoption=(current:()=>boolean)=>{if(!current())throw new Error('The working draft changed while opening. It and its native basis were retained; choose Open again when ready.');};
 const adopt=async(raw:KernelExpressionDocument,current:()=>boolean,file?:NativeFile)=>{
  requireAdoption(current);
  const old=clone(host.snapshot());
  if(host.shouldRetainDraft?.()!==false)await writeDraft(old.journey); // retain authored work, not an untouched boot canvas
  requireAdoption(current);
  const view=await work.adopt(raw,file,current);
  requireAdoption(current);
  restoreGeneration++;selections.cancel();
  host.load(view);status(`Opened ${raw.title} on its exact native revision. ${view.notes.join(' ')}`);update();
 };
 const openReference=async(reference:string,intentCurrent:()=>boolean=()=>true)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const captured=captureNativeAdoption(host,()=>restoreGeneration),current=()=>captured()&&intentCurrent(),basis=work.state;
  const listed=await listKernelExpressions();requireAdoption(current);
  if(basis?.view?.document.expression_ref===reference&&listed.some(entry=>entry.expression_ref===reference)){status('This native work is already open. Its current Scene, selection and unsaved draft were retained.');return;}
  // A live native document may already belong to an authored Journey with
  // its own identity, unsaved material or interrupted operation. Consult that
  // exact checkpoint before deriving a new rendering identity from the ref.
  const recovered=await readWorkingDraft(reference,scope);requireAdoption(current);
  if(recovered){
   if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));requireAdoption(current);
   const view=await work.reopenCheckpoint(recovered.record,recovered.journey,current);
   requireAdoption(current);
   restoreGeneration++;selections.cancel();host.load(view);update();
   status('Working composition recovered through its native owner. Unsaved edits and interrupted operations were retained.');return;
  }
  await adopt(await readKernelExpression(reference) as KernelExpressionDocument,current);
 };
 const opens=new NativeOpenIntent({
  idle:async()=>{while(busy)await ownerIdle;},
  open:(reference,current)=>run(()=>openReference(reference,current)),
  changed:()=>{update();if(opens.reference&&lastFailure)panel.hidden=false;},
 });
 const requestOpen=(reference:string)=>{
  if(!reference.startsWith('expression:')){status('Choose a native Expression reference');return Promise.resolve(false);}
  return opens.submit(reference,captureNativeAdoption(host,()=>restoreGeneration));
 };
 const loadFile=async(path:string)=>{
  const current=captureNativeAdoption(host,()=>restoreGeneration),result=await nativeFileRequest({operation:'open',path}) as {document:KernelExpressionDocument;file:NativeFile};
  if(!result?.document||!result.file)throw new Error('The native file was not returned');
  await adopt(result.document,current,{location:result.file.location,revision:result.file.revision,expression_ref:result.document.expression_ref});
 };
 const changePage=async(delta:number)=>{
  const record=work.state,snapshot=host.snapshot(),view=record?.view,binding=view?.bindings[snapshot.sceneId];
  if(!record||!view||!binding)throw new Error('No native Scene is currently addressed');
  if(record.pending)throw new Error('Inspect the interrupted operation before changing the displayed member page');
  if(prepareCompositionEdit(view,snapshot.journey).changes.length)throw new Error('Commit this edited member page before changing disclosure. No draft or hidden member was discarded.');
  const pages=Object.fromEntries(Object.values(view.bindings).map(item=>[item.scene_ref,item.page]));
  pages[binding.scene_ref]=binding.page+delta;
  const identity={expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,item])=>[item.scene_ref,id])),entities:view.entity_ids};
  const next=kernelDocumentToJourney(view.document,{identity,pages});
  const updated={...record,view:next};await writeWorkingCheckpoint(record.draft_id,updated,scope);work.restore(updated,snapshot.journey);
  host.load(next,true);status('Only the loaded member page changed. Native identity, membership, sources and file are unchanged.');
 };
 // The exact native work the verso must account for: the open Expression on
 // its current revision, and the exact Scene / entity-or-relation occurrence
 // the native selection stands on. Null when no native work is open (the
 // verso then falls back to the host's own subject). Refs only — the cradle
 // reads the content and revalidates the revision through the owner.
 const nativeSubject=():NativeSubject|null=>{
  const doc=work.state?.view?.document;if(!doc)return null;
  return {ref:doc.expression_ref,kind:'expression',nativeOwner:'oi',revision:doc.revision,title:doc.title,
   sceneRef:doc.selection?.scene_ref??null,entityRef:doc.selection?.entity_ref??null,relationRef:doc.selection?.relation_ref??null};
 };
 // The real facets the M′ instruments stand on, derived from the OPEN kernel
 // Expression — never a hardcoded guess. A lens uses this to disclose its own
 // availability and material.
 const construction=():ConstructionFacets|null=>{
  const view=work.state?.view,doc=view?.document;if(!view||!doc)return null;
  const scenes=doc.scenes.map(s=>{
   const binding=Object.values(view.bindings).find(b=>b.scene_ref===s.scene_ref);
   return {scene_ref:s.scene_ref,title:s.title,members:s.entity_refs.length,relations:binding?.relations.length??0};
  });
  return {ref:doc.expression_ref,revision:doc.revision,title:doc.title,
   members:Object.keys(doc.entities).length,relations:Object.keys(doc.relations??{}).length,
   scenes,currentScene:doc.selection?.scene_ref??null};
 };
 panel.addEventListener('click',event=>{
  const action=(event.target as HTMLElement).closest<HTMLElement>('[data-native]')?.dataset.native;if(!action)return;
  if(action==='close'){panel.hidden=true;return;}
  if(action==='retry-open'){void opens.retry();return;}
  if(action==='open'){void requestOpen(field('expression').value);return;}
  if(action==='library'||action==='verso'){host.summon(action,action==='verso'?nativeSubject()??undefined:undefined);return;}
  void run(async()=>{
   if(!kernelExpressionsAvailable())throw new Error('The native host channel is not ready. No native operation has been staged.');
   if(action==='refresh'){await refresh();return;}
   if(action==='open-file'){await loadFile(field('path').value);return;}
   if(action==='inspect'){
    const before=work.state,version=host.version();
    const clean=before?.view&&!prepareCompositionEdit(before.view,host.snapshot().journey).changes.length;
    const result=await work.inspectPending();
    if(before?.pending?.kind==='connections'&&work.state?.view){
     if(clean&&host.version()===version){
      restoreGeneration++;selections.cancel();host.load(work.state.view,true);
     }else{
      status(`${result} Newer local edits remain in your working draft.`);return;
     }
    }
    status(result);return;
   }
   if(action==='retry'){const file=await work.retryFile();status(`Verified the exact retained file save: ${file.location.path}. No new operation identity was minted.`);return;}
   if(action==='previous'||action==='next'){await changePage(action==='next'?1:-1);return;}
   const snapshot=clone(host.snapshot()),version=host.version();
   if(action==='commit'){
    await retainSubmitted(snapshot);
    const doc=await work.commit(snapshot);
    status(`Native working revision ${doc.revision} committed.${host.version()!==version?' Newer local edits remain a separate draft.':''} Save native file for durable reopening.`);
   }else if(action==='save'){
    await retainSubmitted(snapshot);
    const file=await work.saveFile(snapshot,{parent_path:field('folder').value,name:field('name').value});
    status(`Saved and independently read ${file.location.path}.${host.version()!==version?' Newer local edits are still unsaved.':''} Native Return to a constellation remains its own operation.`);
   }
  });
 });
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.hidden=true;event.stopPropagation();}});
 return {
  toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){update();(panel.querySelector('[data-native="close"]') as HTMLButtonElement).focus();if(!lastFailure)void run(refresh);}},
  open:requestOpen,
  cancelOpen:()=>{opens.cancel();update();},
  openFile:(path:string)=>run(()=>loadFile(path)),
  refresh:update,
  /** Follow the same Expression to a newer owner revision when the draft is
   * clean. Resolves false (draft kept) when there is local work to reconcile. */
  advance:async():Promise<boolean>=>{
   let adopted=false;
   await run(async()=>{
    const current=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.advanceClean(host.snapshot().journey,current);
    if(!view)return;
    restoreGeneration++;selections.cancel();host.load(view,true);update();adopted=true;
   });
   return adopted;
  },
  select:(sceneId:string,entityId:string|null,bindingRef?:string)=>{
   const nativeRef=work.state?.view?.document.expression_ref;
   if(!nativeRef)return Promise.resolve('invalidated' as const);
   return selections.submit({generation:restoreGeneration,nativeRef,sceneId,entityId,bindingRef});
  },
  async changed(journey:Journey){
   opens.cancel();const generation=++restoreGeneration;selections.cancel();work.detach();host.correspondence({},null);
   try{const record=await readWorkingCheckpoint(journey.id,scope);if(generation!==restoreGeneration||host.snapshot().journey.id!==journey.id)return;if(record)work.restore(record,journey);update();}
   catch(error){if(generation===restoreGeneration){lastFailure=true;status(`Native recovery was not adopted: ${error instanceof Error?error.message:String(error)}`);update();}}
  },
  inspect(){const state=work.state;return {native_ref:state?.view?.document.expression_ref,revision:state?.view?.document.revision,file:state?.file,pending:state?.pending?.kind,notes:state?.view?.notes??[],bindings:state?.view?.bindings};},
  edit:async(changes:Record<string,unknown>[])=>{
   if(!changes.length)return;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view;
    if(!current)throw new Error('Open a native Expression before editing its connections.');
    if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw new Error('Commit the current composition before editing its connections. The draft was retained.');
    const version=host.version();
    const view=await work.editConnections(changes);
    if(host.version()!==version)throw new Error('The connection was saved natively; newer local edits remain in your working draft.');
    restoreGeneration++;selections.cancel();
    host.load(view,true);update();

   });
   if(!succeeded)throw new Error(notice||'The native edit was not acknowledged.');
  },
  duplicateOccurrence:async(sceneId:string,entityId:string):Promise<void>=>{
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,binding=current?.bindings[sceneId];
    const occurrence=binding?.occurrences.find(row=>row.view_entity_id===entityId);
    if(!current||!binding||!occurrence)throw new Error('Choose a source occurrence in the current native Scene');
    if(host.snapshot().sceneId!==sceneId)throw new Error('The selected Scene changed before duplication');
    if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw new Error('Save the current composition before duplicating its source occurrence. Your draft is retained.');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.duplicateOccurrence({operation:'duplicate',scene_ref:binding.scene_ref,entity_ref:occurrence.entity_ref,new_entity_ref:current.document.expression_ref+':entity:occurrence-'+crypto.randomUUID()});
    if(!adoption())throw new Error('The occurrence was duplicated natively; newer local work remains in your draft. Reopen its native composition when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw new Error(notice||'The native duplicate was not acknowledged.');
  },
  insertSource:async(choice:SourceOccurrenceChoice):Promise<void>=>{
   const captured=clone(choice);
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,active=host.snapshot(),binding=current?.bindings[active.sceneId];
    if(!current||current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||binding?.scene_ref!==captured.scene_ref)throw new Error('The native Scene changed while choosing a source; choose again from its current composition');
    if(prepareCompositionEdit(current,active.journey).changes.length)throw new Error('Save the current composition before inserting a source. Your draft is retained.');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.insertSource({operation:'insert-source',scene_ref:captured.scene_ref,new_entity_ref:captured.expression_ref+':entity:occurrence-'+crypto.randomUUID(),title:captured.title,binding:captured.binding});
    if(!adoption())throw new Error('The source was inserted natively; newer local work remains in your draft. Reopen its native composition when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw new Error(notice||'The native source insertion was not acknowledged.');
  },
  nativeView:()=>work.state?.view,
  blueprint:async(intent:BlueprintIntent):Promise<void>=>{
   const captured=clone(intent);
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,active=host.snapshot(),binding=current?.bindings[active.sceneId];
    if(!current||current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||binding?.scene_ref!==captured.scene_ref)throw Error('The native Scene changed; inspect its blueprint before trying again');
    if(prepareCompositionEdit(current,active.journey).changes.length)throw Error('Save the current composition before changing its blueprint. Your draft is retained.');
    await retainSubmitted(active);
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.editBlueprint(captured);
    if(!adoption())throw Error('The blueprint was saved natively; newer local work remains in your draft. Reopen when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw Error(notice||'The native blueprint was not acknowledged');
  },
  refreshReference:(reference:string)=>run(async()=>{
   if(work.state?.pending)throw new Error('Inspect the interrupted operation before refreshing this work. Its recovery was retained.');
   const current=work.state?.view;
   if(!current||current.document.expression_ref!==reference){await openReference(reference);return;}
   if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw new Error('Commit the current edits before opening a different native selection. Your draft was retained.');
   const adoption=captureNativeAdoption(host,()=>restoreGeneration);
   await adopt(await readKernelExpression(reference) as KernelExpressionDocument,adoption);
  }),
  nativeSubject,
  construction,
  // Persist the current composition — its scenes, members and relations —
  // to the native Expression through the owner (kernel scene_create/edit with
  // the expected-revision basis check; a stale reply is refused, never
  // retried). This is the native scene act M3′ commits to, not a browser save.
  commit:async()=>{
   // A focus write may still be acknowledging the click that began editing.
   // Keep this submitted draft and wait for that owner operation; busy is not
   // a failed save. Navigation still invalidates work addressed to the old doc.
   const snapshot=clone(host.snapshot()),version=host.version();
   return mutate(async()=>{
    await retainSubmitted(snapshot);
    const doc=await work.commit(snapshot);
    status(`Native working revision ${doc.revision} committed — ${doc.scenes.length} scene${doc.scenes.length===1?'':'s'}, ${Object.keys(doc.entities).length} member${Object.keys(doc.entities).length===1?'':'s'} persisted to the native Expression.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
   });
  },
 };
}
