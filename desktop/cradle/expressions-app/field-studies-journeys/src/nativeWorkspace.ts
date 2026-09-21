/** Working controls for the actual hosted application. The browser gallery
 * remains useful for drafts; the native Library, files and mutations remain
 * owned by the cradle. Neither opening this panel nor inspecting a file
 * publishes material or starts an Agent. */
import {clone,type Journey} from './model.js';
import {esc} from './icons.js';
import {NativeWorking,type NativeFile,type WorkingSnapshot} from './nativeWorking.js';
import {kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,nativeExpressionRequest,nativeFileRequest} from './kernelExpressions.js';
import {readWorkingCheckpoint,writeWorkingCheckpoint,writeDraft} from './recovery.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {nativeConnections} from './nativeCorrespondence.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {prepareCompositionEdit} from './kernelComposition.js';
import {NativeSelectionQueue} from './nativeSelectionQueue.js';

export interface NativeWorkspaceHost {
 snapshot:()=>WorkingSnapshot;
 version:()=>number;
 load:(view:KernelConversion,preservePosition?:boolean)=>void;
 toast:(message:string,duration?:number)=>void;
 summon:(kind:'library'|'verso'|'search')=>void;
 correspondence:(rows:Record<string,ConnectionBinding[]>,selection:string|null)=>void;
}
export function installNativeWorkspace(host:NativeWorkspaceHost){
 const scope=new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
 const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
  checkpoint:(id,value)=>writeWorkingCheckpoint(id,value,scope),mint:()=>`expression:authored-${crypto.randomUUID()}`});
 const panel=document.createElement('aside');panel.id='native-work';panel.className='native-work hud-panel chrome';panel.hidden=true;panel.setAttribute('aria-label','Native composition');
 panel.innerHTML=`<header><div><span class="panel-kicker">NATIVE COMPOSITION</span><h2>Keep the whole work</h2></div><button type="button" data-native="close" aria-label="Close native composition">×</button></header>
 <p class="native-status" role="status" aria-live="polite"></p><p class="native-basis"></p>
 <div class="native-actions"><button type="button" class="secondary" data-native="commit">Commit composition</button><button type="button" class="secondary" data-native="inspect">Inspect interrupted operation</button><button type="button" class="secondary" data-native="retry">Retry exact file save</button></div>
 <fieldset><legend>Native file</legend><label>Central folder<input data-native-field="folder" value="." placeholder="Central-relative folder"></label><label>Filename<input data-native-field="name" value="expression.json" placeholder="expression.json"></label><button type="button" class="secondary" data-native="save">Save native file</button><p class="native-file"></p></fieldset>
 <fieldset><legend>Continue native work</legend><div class="native-actions"><button type="button" data-native="library">Library</button><button type="button" data-native="verso">Account / sources</button><button type="button" data-native="refresh">Refresh open work</button></div><label>Open native Expression<select data-native-field="expression"><option value="">Choose open work…</option></select></label><button type="button" class="secondary" data-native="open">Open selected work</button><label>Or open an exact native file<input data-native-field="path" placeholder="Project/file.expression.json"></label><button type="button" class="secondary" data-native="open-file">Open file</button></fieldset>
 <section class="native-disclosure"><h3>Field disclosure</h3><p class="native-page"></p><div class="native-actions"><button type="button" data-native="previous">Previous members</button><button type="button" data-native="next">Next members</button></div></section>
 <p class="native-note">Commit updates the native working document. Save writes and independently reads its file. Browser draft backup is neither native Return nor publication.</p>`;
 document.body.appendChild(panel);
 let busy=false,notice='',restoreGeneration=0;
 const field=(name:string)=>panel.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-native-field="${name}"]`)!;
 const status=(text:string)=>{notice=text;panel.querySelector('.native-status')!.textContent=text;};
 const update=()=>{
  const state=work.state,doc=state?.view?.document;
  host.correspondence(nativeConnections(state?.view),doc?.selection?.relation_ref??null);
  panel.querySelector('.native-basis')!.textContent=doc?`${doc.title} · revision ${doc.revision} · ${doc.expression_ref}`:'This authoring draft does not yet have a native identity. Its first commit creates one.';
  panel.querySelector('.native-file')!.textContent=state?.file?`Saved at ${state.file.location.path} · ${state.file.revision}`:'No verified native file is attached to this working draft.';
  const pending=state?.pending;
  panel.querySelectorAll<HTMLButtonElement>('[data-native]').forEach(button=>{button.disabled=busy&&!['close','library','verso'].includes(button.dataset.native!);});
  (panel.querySelector('[data-native="inspect"]') as HTMLButtonElement).hidden=!pending;
  (panel.querySelector('[data-native="retry"]') as HTMLButtonElement).hidden=pending?.kind!=='file';
  const binding=state?.view?.bindings[host.snapshot().sceneId];
  panel.querySelector('.native-page')!.textContent=binding?`${binding.occurrences.length} represented of ${binding.member_refs.length} native memberships · page ${binding.page+1}/${binding.page_count}${binding.hidden_refs.length?` · ${binding.hidden_refs.length} deliberately hidden`:''}`:'Open or commit a native composition to inspect its exact occurrences.';
  (panel.querySelector('[data-native="previous"]') as HTMLButtonElement).disabled=busy||!binding||binding.page<=0;
  (panel.querySelector('[data-native="next"]') as HTMLButtonElement).disabled=busy||!binding||binding.page>=binding.page_count-1;
  field('folder').disabled=busy||!!state?.file;field('name').disabled=busy||!!state?.file;
 };
 const run=async(task:()=>Promise<void>):Promise<boolean>=>{
  if(busy)return false;busy=true;update();status('Reading or saving through the native owner…');
  try{await task();return true;}catch(error){status(error instanceof Error?error.message:String(error));host.toast(notice,7000);return false;}
  finally{busy=false;update();selections.resume();}
 };
 type FocusIntent={generation:number;nativeRef:string;sceneId:string;entityId:string|null;bindingRef?:string};
 const selections=new NativeSelectionQueue<FocusIntent>({
  available:()=>!busy&&!work.busy,
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
 const adopt=async(raw:KernelExpressionDocument,version:number,file?:NativeFile)=>{
  if(host.version()!==version)throw new Error('The working draft changed while opening. It was not replaced; choose Open again when ready.');
  const previous=work.state,old=host.snapshot();
  await writeDraft(old.journey); // do not discard the old authored work on navigation
  const view=await work.adopt(raw,file);
  if(host.version()!==version){if(previous)work.restore(previous,old.journey);else work.detach();throw new Error('Newer local work was retained instead of being replaced by the returning open request.');}
  restoreGeneration++;selections.cancel();
  host.load(view);status(`Opened ${raw.title} on its exact native revision. ${view.notes.join(' ')}`);update();
 };
 const openReference=async(reference:string)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const version=host.version(),current=work.state;
  if(current?.view?.document.expression_ref===reference){status('This native work is already open. Its current Scene, selection and unsaved draft were retained.');return;}
  await adopt(await readKernelExpression(reference) as KernelExpressionDocument,version);
 };
 const loadFile=async(path:string)=>{
  const version=host.version(),result=await nativeFileRequest({operation:'open',path}) as {document:KernelExpressionDocument;file:NativeFile};
  if(!result?.document||!result.file)throw new Error('The native file was not returned');
  await adopt(result.document,version,{location:result.file.location,revision:result.file.revision,expression_ref:result.document.expression_ref});
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
 panel.addEventListener('click',event=>{
  const action=(event.target as HTMLElement).closest<HTMLElement>('[data-native]')?.dataset.native;if(!action)return;
  if(action==='close'){panel.hidden=true;return;}
  if(action==='library'||action==='verso'){host.summon(action);return;}
  void run(async()=>{
   if(!kernelExpressionsAvailable())throw new Error('The native host channel is not ready. No native operation has been staged.');
   if(action==='refresh'){await refresh();return;}
   if(action==='open'){await openReference(field('expression').value);return;}
   if(action==='open-file'){await loadFile(field('path').value);return;}
   if(action==='inspect'){status(await work.inspectPending());return;}
   if(action==='retry'){const file=await work.retryFile();status(`Verified the exact retained file save: ${file.location.path}. No new operation identity was minted.`);return;}
   if(action==='previous'||action==='next'){await changePage(action==='next'?1:-1);return;}
   const snapshot=clone(host.snapshot()),version=host.version();
   if(action==='commit'){
    const doc=await work.commit(snapshot);
    status(`Native working revision ${doc.revision} committed.${host.version()!==version?' Newer local edits remain a separate draft.':''} Save native file for durable reopening.`);
   }else if(action==='save'){
    const file=await work.saveFile(snapshot,{parent_path:field('folder').value,name:field('name').value});
    status(`Saved and independently read ${file.location.path}.${host.version()!==version?' Newer local edits are still unsaved.':''} Native Return to a constellation remains its own operation.`);
   }
  });
 });
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.hidden=true;event.stopPropagation();}});
 return {
  toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){update();(panel.querySelector('[data-native="close"]') as HTMLButtonElement).focus();void run(refresh);}},
  open:(reference:string)=>run(()=>openReference(reference)),
  openFile:(path:string)=>run(()=>loadFile(path)),
  refresh:update,
  select:(sceneId:string,entityId:string|null,bindingRef?:string)=>{
   const nativeRef=work.state?.view?.document.expression_ref;
   if(!nativeRef)return Promise.resolve('invalidated' as const);
   return selections.submit({generation:restoreGeneration,nativeRef,sceneId,entityId,bindingRef});
  },
  async changed(journey:Journey){
   const generation=++restoreGeneration;selections.cancel();work.detach();host.correspondence({},null);
   try{const record=await readWorkingCheckpoint(journey.id,scope);if(generation!==restoreGeneration||host.snapshot().journey.id!==journey.id)return;if(record)work.restore(record,journey);update();}
   catch(error){if(generation===restoreGeneration){status(`Native recovery was not adopted: ${error instanceof Error?error.message:String(error)}`);update();}}
  },
  inspect(){const state=work.state;return {native_ref:state?.view?.document.expression_ref,revision:state?.view?.document.revision,file:state?.file,pending:state?.pending?.kind,notes:state?.view?.notes??[],bindings:state?.view?.bindings};},
 };
}
