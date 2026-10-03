/** Genuine mounted saved-identity Use refusals in the existing owned setup.
 * Only actual native HTTP responses are delayed, then delivered unchanged.
 * No native result, identity, personal reading, callback or answer is supplied.
 * This module runs inside the caller's unchanged setup/aggregate deadlines. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const SOURCE_REFUSAL='The saved profile changed during calculation. Review it again.';
const VISIBLE_REFUSAL='The Expression changed while the saved identity was being selected. Return to its current basis and choose again.';
const VOICE_REFUSAL='Error: Advance the field once to open its native voices.';
const timeout=30000;
export async function prepareSavedIdentityUseRefusals({page,frame,bridge,identity,op,nativeDocument,selectActualBody,receipt,output,artifact,onPhase}){
 const report={schema:'epi.saved-identity-use-real-refusals/v1',passed:false,pre_admission:[],
  scope:'Actual mounted Use, controlled native Source CAS and unchanged owner HTTP response holds; no provider/model, fresh sound, whole or installed/H acceptance'};
 const expressionRef=(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking())).native_ref;
 assert.ok(expressionRef&&identity.source?.source_ref&&identity.reading?.person_ref);
 const initialRecord=await frame.evaluate(()=>window.__FIELD_STUDIES__.epiWorld());
 const initialDocument=await nativeDocument(expressionRef),initialJourney=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
 const sourceBefore=(await op({op:'nara_identity',request:{operation:'open',source_ref:identity.source.source_ref}})).data;
 assert.deepEqual(sourceBefore.source,identity.source);assert.deepEqual(sourceBefore.reading.profile,identity.reading.profile);
 const workingBefore=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());assert.ok(workingBefore.file);
 // Capture the actual presented basis BEFORE the controlled Timeline race.
 // The native Document alone cannot prove which body the person was seeing.
 const initialVisible=await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,state=f.getState(),journey=f.getDocument();return{scene_id:journey.scenes[state.sceneIndex].id,selected:[...state.selected]};});
 const initialTool=await frame.evaluate(()=>window.__FIELD_STUDIES__.getState().tool);
 assert.ok(['interact','select'].includes(initialTool),'This controlled presented basis uses an ordinary Interact or Select tool');
 const initialBinding=workingBefore.bindings?.[initialVisible.scene_id];
 assert.ok(!workingBefore.busy&&!workingBefore.pending&&!workingBefore.failed);
 assert.equal(workingBefore.native_ref,expressionRef);assert.equal(workingBefore.revision,initialDocument.revision);
 assert.equal(initialBinding?.scene_ref,initialDocument.selection.scene_ref);
 assert.equal(initialDocument.selection.relation_ref??null,null,'This controlled Use fixture starts on one exact body or the unselected Scene, not a relation');
 const initialOccurrence=initialBinding?.occurrences.find(row=>row.entity_ref===initialDocument.selection.entity_ref);
 if(initialDocument.selection.entity_ref)assert.ok(initialOccurrence,'The originally selected native body must be loaded before this fixture');
 assert.deepEqual(initialVisible.selected,initialOccurrence?[initialOccurrence.view_entity_id]:[],
  'The genuine initial presented selection must match the exact current native selection before any controlled negative');
 artifact('saved-use-initial-presented-basis.json',{expression_ref:expressionRef,document_revision:initialDocument.revision,native_selection:initialDocument.selection,visible:initialVisible,tool:initialTool,
  standing:'Actual local state and independently inspected native basis before controlled Source/Timeline negatives; no forced selection or baseline rewrite'});
 const pinCount=()=>receipt.issued_requests.filter(row=>row.op==='nara_current'&&row.operation==='pin').length;
 const originalPins=pinCount();
 const durable=async label=>{
  const reply=(await op({op:'expression',request:{operation:'inspect_file',location:workingBefore.file.location,expected_file_revision:workingBefore.file.revision}})).data;
  assert.equal(reply.state,'ready');
  assert.deepEqual(reply.file,{location:workingBefore.file.location,revision:workingBefore.file.revision},'inspect_file returns the exact native file location/revision pair, qualified against the independently retained full working basis');
  assert.equal(workingBefore.file.expression_ref,expressionRef);
  assert.equal(reply.document.expression_ref,workingBefore.file.expression_ref);
  assert.equal(reply.document.revision,workingBefore.file.document_revision);
  return {label,document:reply.document,file:structuredClone(workingBefore.file),actual_file:reply.file};
 };
 const durableBefore=await durable('before-refusals');
 const use=()=>frame.getByRole('button',{name:'Use saved identity',exact:true});
 const openSaved=async()=>{
  const modal=frame.locator('#nara-instrument');if(!await modal.isVisible())await frame.locator('[data-epi="identity"]').click();
  const profiles=frame.locator('.nara-personal select[aria-label="Saved profiles"]');
  await profiles.selectOption('');await profiles.selectOption(identity.source.source_ref);
  await frame.waitForFunction(()=>Array.from(document.querySelectorAll('.nara-personal button')).some(b=>b.textContent==='Use saved identity'&&!b.disabled),null,{timeout});
 };
 const closeDepth=async()=>{const modal=frame.locator('#nara-instrument');if(await modal.isVisible())await modal.press('Escape');assert.equal(await modal.isVisible(),false);};
 const requireNaraFailure=async message=>{
  await frame.waitForFunction(message=>Array.from(document.querySelectorAll('#nara-instrument [role="alert"]')).some(e=>e.textContent===message)
   &&Array.from(document.querySelectorAll('.nara-personal button')).some(b=>b.textContent==='Use saved identity'&&!b.disabled),message,{timeout});
  assert.equal(await frame.locator('#nara-instrument').isVisible(),true);
  assert.ok((await frame.locator('#nara-instrument [role="alert"]').allTextContents()).includes(message));
 };
 const presentScene=async sceneRef=>{
  const index=initialJourney.scenes.findIndex(s=>s.id===sceneRef);assert.ok(index>=0);
  const timeline=frame.locator('#timeline-panel');
  if(!await timeline.isVisible())await frame.locator('[data-action="open-timeline"]').click();
  await frame.locator('[data-action="choose-scene"][data-index="'+index+'"]').click();
  await frame.waitForFunction(ref=>{const f=window.__FIELD_STUDIES__,w=f.nativeWorking(),d=f.getDocument();return !w.busy&&!w.pending&&!w.failed&&d.scenes[f.getState().sceneIndex].id===ref;},sceneRef,{timeout});
  await frame.locator('[data-action="close-timeline"]').click();
  report.ordinary_scene_operations??=[];report.ordinary_scene_operations.push({action:'choose-scene',index,scene_ref:sceneRef,
   source_contract:'app.ts::renderTimeline → action(choose-scene) → setScene',standing:'Actual visible loaded Scene change; no native focus or private source rebind is claimed'});
 };
 const missingBefore=await frame.locator('.epi-world-entrance [data-native-personal-current-refusal] pre').textContent();
 assert.ok(missingBefore?.includes('The saved native personal current has no protected checkpoint; explicitly use this saved identity to admit a new current'));
 const saveRaw=(label,raw)=>{
  const file=label+'.json',bytes=Buffer.isBuffer(raw)?raw:Buffer.from(raw);
  assert.ok(bytes.length<=64*1024*1024);writeFileSync(resolve(output,file),bytes);
  receipt.artifacts.push(file);return{path:file,bytes:bytes.length,sha256:sha(bytes)};
 };
 const hold=async(label,predicate,ordinal,cap,qualify,requestCap=64*1024)=>{
  let count=0,claimed=false,release,observed,rejectObserved,settledResolve,failure;
  const released=new Promise(resolve=>{release=resolve;}),seen=new Promise((resolve,reject)=>{observed=resolve;rejectObserved=reject;}),settled=new Promise(resolve=>{settledResolve=resolve;});
  void seen.catch(()=>{});
  const wait=async(promise,reason)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+': '+reason+' in30s')),timeout);})]);}finally{clearTimeout(timer);}};
  const handler=async route=>{
   let request;const raw=route.request().postData();try{request=raw&&JSON.parse(raw);}catch{}
   if(claimed||!predicate(request)){await route.continue();return;}
   count++;if(count!==ordinal){await route.continue();return;}claimed=true;
   try{
    assert.ok(raw&&Buffer.byteLength(raw)<=requestCap);
    const response=await route.fetch({timeout:60000}),declared=response.headers()['content-length'];
    assert.equal(response.ok(),true);assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=cap);
    const bytes=await response.body();assert.equal(bytes.length,Number(declared));const value=JSON.parse(bytes);
    const evidence={label,ordinal,request:saveRaw(label+'.request',raw),response:saveRaw(label+'.response',bytes),
     held_at:new Date().toISOString(),unchanged_actual_response:true};
    artifact(label+'.hold.json',evidence);qualify(request,value);observed({evidence,request,value});
    await released;await route.fulfill({response});settledResolve();
   }catch(error){failure=error;rejectObserved(error);settledResolve();}
  };
  await page.route(bridge+'/op',handler);
  return {async observed(){return await wait(seen,'exact actual response not held');},
   async release(){release();await wait(settled,'actual response delivery did not settle');if(failure)throw failure;},
   async stop(){
    const failures=[];release();
    try{if(claimed)await wait(settled,'owned response cleanup did not settle');}catch(error){failures.push(error);}
    try{await page.unroute(bridge+'/op',handler);}catch(error){failures.push(error);}
    if(failure)failures.push(failure);
    if(failures.length){(report.transport_errors??=[]).push(...failures.map(String));throw new AggregateError(failures,label+': owned transport cleanup failed');}
   },get count(){return count;}};
 };
 const cleanup=async(label,primary,steps)=>{
  const failures=primary?[primary]:[];
  for(const [name,step] of steps)try{await step();}catch(error){
   (report.cleanup_errors??=[]).push({case:label,operation:name,error:String(error)});failures.push(error);
  }
  if(failures.length){
   report.passed=false;if(primary)(report.primary_errors??=[]).push({case:label,error:String(primary)});
   artifact('saved-use-real-refusals-failure.json',report);
   throw new AggregateError(failures,label+': '+failures.map(String).join(' / '),primary?{cause:primary}:undefined);
  }
 };
 const openPredicate=request=>request?.op==='nara_identity'&&request.request?.operation==='open'&&request.request.source_ref===identity.source.source_ref;
 const qualifyOpen=(request,value)=>{assert.deepEqual(request,{op:'nara_identity',request:{operation:'open',source_ref:identity.source.source_ref}});assert.equal(value.ok,true);assert.equal(value.outcome?.result,'nara_identity');assert.deepEqual(value.outcome.data.source,sourceBefore.source);assert.deepEqual(value.outcome.data.reading.profile,sourceBefore.reading.profile);};
 // First owner read genuinely completes before the controlled Source changes.
 // A held actual old read is not replaced by a stale/fabricated envelope.
 onPhase('ordinary saved-identity Source-CAS refusal');await openSaved();
 const sourceHold=await hold('saved-use-source-first-open',openPredicate,1,16*1024*1024,qualifyOpen);
 let changedSource,sourceFailure;
 try{
  await use().focus();await use().press('Enter');const held=await sourceHold.observed();
  const profile=structuredClone(sourceBefore.reading.profile);profile.name+=' · controlled native Source correction';
  changedSource=(await op({op:'nara_identity',request:{operation:'save',profile,source_ref:sourceBefore.source.source_ref,expected_revision:sourceBefore.source.revision}})).data;
  assert.equal(changedSource.source.source_ref,sourceBefore.source.source_ref);assert.notEqual(changedSource.source.revision,sourceBefore.source.revision);assert.deepEqual(changedSource.reading.profile,profile);
  await sourceHold.release();await requireNaraFailure(SOURCE_REFUSAL);
  assert.equal(pinCount(),originalPins,'A Source-current refusal must not enter native personal acquisition');
  assert.deepEqual(await nativeDocument(expressionRef),initialDocument,'Refused Use must not alter any native world/document value');
  assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),initialJourney);
  report.pre_admission.push({case:'source-current-refusal',passed:true,actual_held:held.evidence,changed_source:changedSource.source,expected_refusal:SOURCE_REFUSAL,zero_current_pin:true});
 }catch(error){sourceFailure=error;}finally{
  await cleanup('source-current-refusal',sourceFailure,[
   ['owned response settlement and unroute',()=>sourceHold.stop()],
   ['controlled native Source CAS restoration',async()=>{
    if(changedSource){const restored=(await op({op:'nara_identity',request:{operation:'save',profile:sourceBefore.reading.profile,source_ref:changedSource.source.source_ref,expected_revision:changedSource.source.revision}})).data;assert.deepEqual(restored.source,sourceBefore.source);assert.deepEqual(restored.reading.profile,sourceBefore.reading.profile);}
   }],
  ]);
 }
 // Delay the actual confirming native read that feeds select_identity's ACK;
 // the actual ordinary Timeline Scene action changes the visible loaded Scene
 // in the meantime; it does not run/clear the Epi encounter or edit its source.
 onPhase('ordinary saved-identity visible Scene refusal');await openSaved();
 const sceneHold=await hold('saved-use-confirming-open',openPredicate,2,16*1024*1024,qualifyOpen);
 const other=initialDocument.scenes.find(s=>s.scene_ref!==initialDocument.selection.scene_ref);assert.ok(other);
 let changedScene,sceneFailure;
 try{
  await use().focus();await use().press('Enter');const held=await sceneHold.observed();
  await closeDepth();await presentScene(other.scene_ref);
  changedScene=await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,d=f.getDocument();return{scene:d.scenes[f.getState().sceneIndex].id,selected:f.getState().selected};});
  assert.deepEqual(changedScene,{scene:other.scene_ref,selected:[]});assert.deepEqual(await nativeDocument(expressionRef),initialDocument);
  await sceneHold.release();
  await frame.waitForFunction(()=>Array.from(document.querySelectorAll('.nara-personal button')).some(b=>b.textContent==='Use saved identity'&&!b.disabled),null,{timeout});
  if(!await frame.locator('#nara-instrument').isVisible())await frame.locator('[data-epi="identity"]').click();await requireNaraFailure(VISIBLE_REFUSAL);
  assert.equal(pinCount(),originalPins,'A visible-basis refusal must not enter native personal acquisition');
  assert.deepEqual(await nativeDocument(expressionRef),initialDocument);assert.deepEqual(await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,d=f.getDocument();return{scene:d.scenes[f.getState().sceneIndex].id,selected:f.getState().selected};}),changedScene,'Refused Use must preserve the deliberately changed visible Scene and local selection');assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),initialJourney);
  report.pre_admission.push({case:'visible-scene-refusal',passed:true,actual_held:held.evidence,changed_scene:other.scene_ref,expected_refusal:VISIBLE_REFUSAL,zero_current_pin:true});
 }catch(error){sceneFailure=error;}finally{
  await cleanup('visible-scene-refusal',sceneFailure,[
   ['owned response settlement and unroute',()=>sceneHold.stop()],
   ['ordinary original Scene and body restoration',async()=>{
    await closeDepth();await presentScene(initialDocument.selection.scene_ref);
    // setScene deliberately clears local focus. Restore only this fixture's
    // captured original body through the existing actual Stage pointer path.
    // Epi's dropdown would begin a new encounter and clear the old refusal;
    // this normal pointer choice preserves that original sticky-error gate.
    await cleanup('visible-scene-body-selection',null,[
     ['ordinary Select control and original body Stage pointer',async()=>{
      if(initialDocument.selection.entity_ref){
       await frame.locator('[data-action="tool-select"]').first().click({timeout:10000});
       await frame.waitForFunction(()=>window.__FIELD_STUDIES__.getState().tool==='select',null,{timeout:10000});
       await selectActualBody(initialDocument.selection.entity_ref);
      }
     }],
     ['ordinary captured tool restoration without another Stage click',async()=>{
      if(await frame.evaluate(()=>window.__FIELD_STUDIES__.getState().tool)!==initialTool)
       await frame.locator('[data-action="tool-'+initialTool+'"]').first().click({timeout:10000});
      await frame.waitForFunction(tool=>window.__FIELD_STUDIES__.getState().tool===tool,initialTool,{timeout:10000});
     }],
    ]);
    await frame.waitForFunction(expected=>{const f=window.__FIELD_STUDIES__,state=f.getState(),journey=f.getDocument(),working=f.nativeWorking();
     return journey.scenes[state.sceneIndex].id===expected.visible.scene_id
      &&JSON.stringify(state.selected)===JSON.stringify(expected.visible.selected)
      &&working.native_ref===expected.expression_ref&&working.revision===expected.document_revision
      &&!working.busy&&!working.pending&&!working.failed;
    },{visible:initialVisible,expression_ref:expressionRef,document_revision:initialDocument.revision},{timeout});
    const restored=await nativeDocument(expressionRef);
    assert.deepEqual(restored,initialDocument,'Restoring the controlled visible basis must leave every native Document value and revision unchanged');
    const visible=await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__,state=f.getState(),journey=f.getDocument();return{scene_id:journey.scenes[state.sceneIndex].id,selected:[...state.selected]};});
    assert.deepEqual(visible,initialVisible);
    report.presented_basis_restoration={operation:'actual Timeline return, ordinary Select control and original body Stage pointer, then captured tool restoration',native_selection:restored.selection,document_revision:restored.revision,visible,tool:initialTool,
     standing:'The originally acknowledged native focus is unchanged; actual pointer/restored local basis independently verified before positive Use'};
    artifact('saved-use-restored-presented-basis.json',report.presented_basis_restoration);
   }]
  ]);
 }
 const restoredFocus=await nativeDocument(expressionRef);assert.deepEqual(restoredFocus,initialDocument);
 assert.deepEqual(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),initialJourney);
 const restoredSource=(await op({op:'nara_identity',request:{operation:'open',source_ref:identity.source.source_ref}})).data;assert.deepEqual(restoredSource.source,sourceBefore.source);assert.deepEqual(restoredSource.reading.profile,sourceBefore.reading.profile);
 const durableAfter=await durable('after-refusals');assert.deepEqual(durableAfter.document,durableBefore.document);assert.deepEqual(durableAfter.file,durableBefore.file);
 assert.equal(pinCount(),originalPins);assert.equal(await frame.locator('.epi-world-entrance [data-native-personal-current-refusal] pre').textContent(),missingBefore,'The native missing-custody failure remains current until deliberate admission, preserving the original sticky-error gate');artifact('saved-use-pre-admission-refusals.json',{report,before_document:initialDocument,after_document:restoredFocus,durable_before:durableBefore,durable_after:durableAfter,source:sourceBefore.source});
 // The caller performs its original positive saved-profile/draft guards next.
 // We only arm an unchanged actual Pin response for the newer-refusal case.
 return {report,async armAcknowledgementRefusal(){
  onPhase('new actual voice consumer refusal during personal acquisition');
  const pinHold=await hold('saved-use-acknowledged-native-pin',r=>r?.op==='nara_current'&&r.request?.operation==='pin',1,64*1024*1024,(request,value)=>{
   assert.equal(value.ok,true);assert.equal(value.outcome?.result,'nara_current');assert.equal(request.request.binding.person_ref,identity.reading.person_ref);assert.equal(request.request.binding.nara_ref,identity.reading.nara_ref);assert.equal(request.request.binding.source_ref,identity.source.source_ref);assert.equal(request.request.binding.expected_revision,identity.source.revision);assert.equal(request.request.binding.expression_ref,expressionRef);assert.ok(value.outcome.data.reading&&value.outcome.data.context?.reading_ref);assert.equal(value.outcome.data.context.event_ref,initialRecord.world.event_ref);assert.equal(value.outcome.data.reading.identity.person_ref,identity.reading.person_ref);
  },64*1024*1024);
  return {async finish(){
   let completionFailure;
   try{
    const held=await pinHold.observed();await closeDepth();
    const actual=await frame.evaluate(()=>window.__FIELD_STUDIES__.native());assert.equal(actual.status,'manual');assert.equal(actual.lease,null);
    const play=frame.locator('.epi-play');if(!await play.evaluate(e=>e.open))await play.locator('summary').click();
    await frame.locator('[data-epi="sound"]').click();
    await frame.waitForFunction(message=>document.querySelector('.epi-world-entrance [role="alert"]')?.textContent===message,VOICE_REFUSAL,{timeout});
    await pinHold.release();
    await frame.waitForFunction(person=>{const f=window.__FIELD_STUDIES__,r=f.epiWorld(),c=f.epiCurrent(),w=f.nativeWorking();return r?.person_ref===person&&c?.reading?.identity?.person_ref===person&&c.context.event_ref===r.world.event_ref&&!w.busy&&!w.pending&&!w.failed&&w.file?.document_revision===w.revision;},identity.reading.person_ref,{timeout:180000});
    assert.equal(await frame.locator('.epi-world-entrance [role="alert"]').innerText(),VOICE_REFUSAL,'Acknowledged personal admission must not erase a newer actual consumer refusal');
    const current=await frame.evaluate(()=>window.__FIELD_STUDIES__.epiCurrent());assert.deepEqual(current.context,held.value.outcome.data.context);assert.deepEqual(current.reading,held.value.outcome.data.reading);
    const after=await nativeDocument(expressionRef);
    report.newer_consumer_refusal={passed:true,expected_refusal:VOICE_REFUSAL,native_pin:held.evidence,actual_controller:{status:actual.status,lease:actual.lease,lifetime:actual.lifetime},
     standing:'Actual ordinary consumer refuses without a following native lease; no native audio operation or sound acceptance is claimed',current_ref:current.context.reading_ref,document_revision:after.revision};
    artifact('saved-use-newer-consumer-refusal.json',report.newer_consumer_refusal);
    // With no selected body, Explore Bimba opens its inventory without a
    // native read. Choose the exact admitted hub in that ordinary disclosure;
    // the parent maps this action to nara_coordinate, not operation:'source'.
    if(after.selection.entity_ref){
     const selectionTool=await frame.evaluate(()=>window.__FIELD_STUDIES__.getState().tool);
     assert.ok(['interact','select'].includes(selectionTool),'The acknowledged personal basis retains an ordinary Interact or Select tool');
     await cleanup('newer-consumer-body-selection',null,[
      ['ordinary Shape & play closure, Select control and unchanged body Stage pointer',async()=>{
       if(await play.evaluate(e=>e.open))await play.locator('summary').click({timeout:10000});
       assert.equal(await play.evaluate(e=>e.open),false,"The actual body surface must be free of this fixture's Shape & play popup before its next pointer selection");
       await frame.locator('[data-action="tool-select"]').first().click({timeout:10000});
       await frame.waitForFunction(()=>window.__FIELD_STUDIES__.getState().tool==='select',null,{timeout:10000});
       await selectActualBody(after.selection.entity_ref);
      }],
      ['ordinary captured tool restoration without another Stage click',async()=>{
       if(await frame.evaluate(()=>window.__FIELD_STUDIES__.getState().tool)!==selectionTool)
        await frame.locator('[data-action="tool-'+selectionTool+'"]').first().click({timeout:10000});
       await frame.waitForFunction(tool=>window.__FIELD_STUDIES__.getState().tool===tool,selectionTool,{timeout:10000});
      }],
     ]);
    }
    const record=await frame.evaluate(()=>window.__FIELD_STUDIES__.epiWorld());
    const hub=record.inventory.filter(row=>row.canonical_ref===record.receiving.personal.canonical_locus);
    assert.equal(hub.length,1);assert.equal(hub[0].coordinate,'M4.4.4.4');
    assert.equal(hub[0].source_revision,initialRecord.inventory[0].source_revision);
    const at=receipt.issued_requests.length;await frame.locator('[data-epi="source"]').click();
    await frame.locator('.epi-source-dialog').waitFor({state:'visible',timeout});
    await frame.getByRole('searchbox',{name:'Find a Bimba subject',exact:true}).fill(hub[0].coordinate);
    const sourceChoice=frame.locator('.epi-source-dialog [data-epi-ref="'+hub[0].canonical_ref+'"]');
    await sourceChoice.waitFor({state:'visible',timeout});assert.equal(await sourceChoice.count(),1);
    // Passive observers retain the unchanged actual response to THIS newly
    // issued UI request. They neither replace a reply nor clear product state.
    let sourceRequest,sourceRawRequest,sourceObserved=false,active=true,resolveSource,rejectSource;
    const sourceAck=new Promise((resolve,reject)=>{resolveSource=resolve;rejectSource=reject;});void sourceAck.catch(()=>{});
    const sourceTimer=setTimeout(()=>rejectSource(Error('The ordinary source choice did not receive its exact native acknowledgement in30s')),timeout);
    const onSourceRequest=request=>{
     if(sourceRequest||request.method()!=='POST'||request.url()!==bridge+'/op')return;
     let value;try{value=request.postDataJSON();}catch{return;}
     if(value?.op!=='nara_coordinate'||value.request?.coordinate_ref!==hub[0].canonical_ref)return;
     try{assert.deepEqual(value,{op:'nara_coordinate',request:{coordinate_ref:hub[0].canonical_ref,face:'bimba',source_only:true}});sourceRawRequest=request.postData();assert.ok(sourceRawRequest&&Buffer.byteLength(sourceRawRequest)<=64*1024);sourceRequest=request;}catch(error){rejectSource(error);}
    };
    const onSourceResponse=async response=>{
     if(sourceObserved||response.request()!==sourceRequest)return;sourceObserved=true;
     try{
      assert.equal(response.status(),200);const declared=response.headers()['content-length'];
      assert.match(declared??'',/^(0|[1-9][0-9]*)$/);assert.ok(Number(declared)<=16*1024*1024);
      const bytes=await response.body();if(!active)return;assert.equal(bytes.length,Number(declared));
      const value=JSON.parse(bytes);assert.equal(value.ok,true);assert.equal(value.outcome?.result,'nara_coordinate');
      const content=value.outcome.data;assert.equal(content.schema,'ql.bimba-coordinate-content/v1');
      assert.equal(content.source_revision,hub[0].source_revision);assert.equal(content.identity.source_revision,hub[0].source_revision);
      assert.equal(content.identity.canonical_ref,hub[0].canonical_ref);assert.equal(content.identity.coordinate,hub[0].coordinate);
      assert.equal(content.identity.uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');assert.equal(content.identity.properties_sha256,hub[0].properties_sha256);
      assert.equal(Object.keys(content.identity.properties??{}).length,64,'The current qualified907 hub retains all determining properties');
      assert.equal(content.relations.length,23,'The current qualified907 hub retains every incident relation');
      assert.ok(content.relations.every(row=>row.orientation==='directed'&&row.source_revision===content.source_revision&&row.properties&&row.properties_sha256&&(row.from_coordinate===hub[0].coordinate||row.to_coordinate===hub[0].coordinate)));
      resolveSource({content,request:saveRaw('saved-use-next-source.request',sourceRawRequest),response:saveRaw('saved-use-next-source.response',bytes)});
     }catch(error){if(active)rejectSource(error);}
    };
    page.on('request',onSourceRequest);page.on('response',onSourceResponse);
    let acknowledgedSource;
    try{await sourceChoice.click();acknowledgedSource=await sourceAck;}finally{active=false;clearTimeout(sourceTimer);page.off('request',onSourceRequest);page.off('response',onSourceResponse);}
    await frame.waitForFunction(basis=>{
     const dialog=document.querySelector('.epi-source-dialog');if(!dialog?.open||dialog.querySelector('h2')?.textContent!==basis.title)return false;
     const details=Array.from(dialog.querySelectorAll('details')),properties=details.find(e=>e.querySelector('summary')?.textContent==='Original properties and supporting text'),relations=details.find(e=>e.querySelector('summary')?.textContent==='Typed relations · '+basis.relations);
     return properties?.querySelectorAll('dl>dt').length===basis.properties&&relations?.querySelectorAll(':scope>ul>li').length===basis.relations
      &&dialog.textContent.includes(basis.coordinate)&&dialog.textContent.includes(basis.uuid)
      &&!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation')&&!document.querySelector('.epi-world-entrance [role="alert"]');
    },{title:acknowledgedSource.content.identity.title,coordinate:hub[0].coordinate,uuid:acknowledgedSource.content.identity.uuid,properties:64,relations:23},{timeout});
    assert.ok(receipt.issued_requests.slice(at).some(row=>row.op==='nara_coordinate'),'A real source request, not a diagnostic clear hook, must acknowledge the next encounter');
    await frame.locator('[data-epi-source="return"]').click();
    await frame.waitForFunction(()=>!document.querySelector('.epi-source-dialog')?.open&&!document.querySelector('.epi-world-entrance [role="alert"]')&&!window.__FIELD_STUDIES__.nativeWorking().busy,null,{timeout});
    assert.deepEqual(await nativeDocument(expressionRef),after,'Ordinary Source and Return must leave the complete admitted native Document unchanged');
    report.source_cleanup={coordinate_ref:hub[0].canonical_ref,source_revision:hub[0].source_revision,native_operation:'nara_coordinate',source_only:true,acknowledged:true,request:acknowledgedSource.request,response:acknowledgedSource.response,document_revision:after.revision,selection:after.selection};
    artifact('saved-use-next-source-ack.json',report.source_cleanup);
   }catch(error){completionFailure=error;}finally{
    await cleanup('newer-consumer-refusal',completionFailure,[['owned actual Pin response settlement and unroute',()=>pinHold.stop()]]);
   }
   report.passed=true;artifact('saved-use-real-refusals.json',report);return report;
  }};
 }};
}
