/** Additive real ordinary Epi body-binding gate. Called after the original saved
 * first construction, or after the complete two-world gates. Actual
 * identity, current and Coordinate replies are consumed unchanged. No reply,
 * private current, canonical source, identity or renderer value is manufactured.
 */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function runEpiPersonalBodyBindingGate({server,frame,world,foreignWorld,identities,op,nativeDocument,savedFile,action,snapshot,check,artifact}){
 const {preparePersonalBodyBindings}=await server.ssrLoadModule('/expressions-app/field-studies-journeys/src/naraPersonalBody.ts');
 const {readEpiWorldRecord}=await server.ssrLoadModule('/expressions-app/field-studies-journeys/src/epiWorldProduction.ts');
 const ref=world.working.native_ref,before=await nativeDocument(ref),record=readEpiWorldRecord(before);
 assert.ok(record&&world.current,'An ordinary native constructed/admitted world is required');
 if(foreignWorld)assert.ok(foreignWorld.current,'The full-world counterproof requires another actual constructed/admitted world');
 assert.equal(record.world.instance_ref,ref);assert.equal(before.selection.scene_ref,`${ref}:scene:personal`);
 if(foreignWorld){assert.notEqual(record.person_ref,foreignWorld.record.person_ref);assert.notEqual(ref,foreignWorld.working.native_ref);assert.deepEqual(record.world.sky,foreignWorld.record.world.sky,'The foreign control is another real person at the same admitted occasion');}
 assert.deepEqual(await savedFile(world.working,'body-binding-before'),before);
 const identity=identities.find(value=>value.reading.person_ref===record.person_ref);
 const foreignIdentity=foreignWorld?identities.find(value=>value.reading.person_ref===foreignWorld.record.person_ref):null;
 assert.ok(identity);if(foreignWorld)assert.ok(foreignIdentity);assert.deepEqual(identity.source,record.identity_source);
 const opened=(await op({op:'nara_identity',request:{operation:'open',source_ref:identity.source.source_ref}})).data;
 assert.deepEqual(opened.source,identity.source);assert.equal(opened.reading.input_revision,record.identity_input_revision);
 assert.equal(opened.reading.person_ref,record.person_ref);assert.equal(opened.reading.nara_ref,record.nara_ref);
 const calculated=(await op({op:'nara_identity',request:{operation:'calculate',profile:opened.reading.profile}})).data;
 assert.equal(calculated.reading.input_revision,opened.reading.input_revision);assert.equal(calculated.reading.person_ref,record.person_ref);
 assert.equal(calculated.reading.nara_ref,record.nara_ref);assert.equal(calculated.reading.natal_composition.centre_evidence.length,7);
 const foreignOpened=foreignIdentity?(await op({op:'nara_identity',request:{operation:'open',source_ref:foreignIdentity.source.source_ref}})).data:null;
 if(foreignIdentity)assert.deepEqual(foreignOpened.source,foreignIdentity.source);
 const currentRequest={op:'nara_current',project:'',request:{operation:'read',binding:{operation:'context',role:'nara',source_ref:record.identity_source.source_ref,expected_revision:record.identity_source.revision,person_ref:record.person_ref,nara_ref:record.nara_ref,expression_ref:ref}}};
 const current=(await op(currentRequest)).data;
 assert.equal(current.status,'available');assert.equal(current.private,true);assert.equal(current.public_export,false);
 assert.deepEqual(current.context,world.current.context);assert.deepEqual(current.reading,world.current.reading);
 assert.deepEqual(record.receiving.personal.current,{ref:current.context.reading_ref,revision:current.context.reading_revision,availability:'available'});
 const scene=before.scenes.find(value=>value.scene_ref===before.selection.scene_ref);
 const template_bindings=scene.presentation.scene.entities.filter(value=>value.native?.chakraId).map(value=>({entity_ref:value.id,chakraId:value.native.chakraId}));
 assert.equal(template_bindings.length,7);
 const earthRefs=scene.entity_refs.filter(value=>before.entities[value].subject?.subject_ref==='ql:m-coordinate:bimba:M2-5-0/1-0');assert.equal(earthRefs.length,1);
 const input={document:before,scene_ref:scene.scene_ref,centre_evidence:calculated.reading.natal_composition.centre_evidence,template_bindings,earth_entity_ref:earthRefs[0],personal_basis:{person_ref:record.person_ref,nara_ref:record.nara_ref,input_revision:record.identity_input_revision,identity_source:opened.source}};
 const coordinateReplies=[];
 const read=async request=>{const result=(await op({op:'nara_coordinate',request})).data;coordinateReplies.push({request,result});return result;};
 const prepared=await preparePersonalBodyBindings(read,input);
 assert.equal(prepared.centres.length,7);assert.ok(prepared.source_relations.length>0);assert.ok(prepared.earth);
 for(const centre of prepared.centres){assert.deepEqual(centre.subject_binding,before.entities[centre.entity_ref].subject);assert.equal(prepared.changes.some(change=>change.change==='subject_bind'&&change.entity_ref===centre.entity_ref),false);}
 const earthBefore=before.entities[earthRefs[0]].subject,canonical=coordinateReplies.at(-1).result.subject_binding.sources[0];
 assert.deepEqual(prepared.earth.binding.sources,earthBefore.sources);assert.deepEqual(prepared.earth.binding.actions,earthBefore.actions);
 const expectedEarthReadings=earthBefore.readings.some(value=>isDeepStrictEqual(value,canonical))?earthBefore.readings:[...earthBefore.readings,canonical];
 assert.deepEqual(prepared.earth.binding.readings,expectedEarthReadings,'Only the original explicit Earth source-reading supplement may be added');
 assert.ok(prepared.changes.every(change=>change.change==='relation_bind'||change.change==='subject_bind'&&change.entity_ref===earthRefs[0]));
 const createEquivalent=await preparePersonalBodyBindings(read,{...input,earth_entity_ref:undefined,create_earth:{entity_ref:`${ref}:entity:occurrence-${randomUUID()}`}});
 assert.deepEqual(createEquivalent.changes,prepared.changes,'The UI create-Earth route must reuse the actual ordinary Earth, never insert another');
 assert.deepEqual(await nativeDocument(ref),before,'Production preparation is read-only');
 const negatives=[];
 const originalCoordinateReplies=coordinateReplies.slice(0,8);
 const sourceEndpoints=new Set([...prepared.centres.map(value=>value.source_ref),prepared.earth.source_ref]),sourceRelations=new Map();
 for(const row of originalCoordinateReplies.flatMap(value=>value.result.binding.source_relations)){
  if(!sourceEndpoints.has(row.from_ref)||!sourceEndpoints.has(row.to_ref)||!['ASCENDS_TO','GROUNDS_CHAKRAL_PATHWAY','FEEDS_EARTH_ELEMENT'].includes(row.source_kind))continue;
  if(sourceRelations.has(row.relation_ref))assert.deepEqual(sourceRelations.get(row.relation_ref),row);else sourceRelations.set(row.relation_ref,row);
 }
 assert.deepEqual(prepared.source_relations,[...sourceRelations.values()].sort((a,b)=>a.id.localeCompare(b.id)),'Retain every actual native relation ID/endpoint/field; no filler or duplicate cloning');
 const reject=async(label,mutate)=>{
  const bad=structuredClone(input);mutate(bad);
  await assert.rejects(()=>preparePersonalBodyBindings(read,bad),/different native identity|inconsistent native|native instance|native owner-role|runtime-buffer|personal locus|body source changed|anatomical property/);
  assert.deepEqual(await nativeDocument(ref),before);assert.deepEqual(await savedFile(world.working,'body-binding-'+label),before);
  const unchanged=(await op(currentRequest)).data;assert.deepEqual(unchanged.context,current.context);assert.deepEqual(unchanged.reading,current.reading);
  negatives.push(label);
 };
 if(foreignWorld){
 await reject('actual-foreign-person',bad=>{bad.personal_basis.person_ref=foreignOpened.reading.person_ref;});
 await reject('actual-foreign-saved-source',bad=>{bad.personal_basis.identity_source=foreignOpened.source;});
 await reject('actual-foreign-current-binding',bad=>{
  const subject=bad.document.entities[record.receiving.personal.centre_entity_refs[0]].subject;
  const foreign={ref:foreignWorld.current.context.reading_ref,revision:foreignWorld.current.context.reading_revision,availability:'available'};
  subject.readings=subject.readings.map(value=>value.ref===current.context.reading_ref?foreign:value);
 });
 await reject('undeclared-actual-world-reading',bad=>{bad.document.entities[record.receiving.personal.centre_entity_refs[0]].subject.readings.push(foreignWorld.record.native_source.world_ref);});
 }
 await reject('different-actual-coordinate-profile',bad=>{bad.document.entities[record.receiving.personal.centre_entity_refs[0]].subject.readings[0]=coordinateReplies[1].result.subject_binding.readings[0];});
 await reject('different-role',bad=>{bad.document.entities[record.receiving.personal.centre_entity_refs[0]].subject.presentation_role='being';});
 await reject('stale-anatomical-witness',bad=>{bad.centre_evidence[0].body.body_zone.payload_sha256+='-stale';});
 check(negatives.length===(foreignWorld?7:3),'Actual native overlay/profile/role/anatomical witness counterproofs refuse; genuine two-person source/current controls run when the full whole has constructed both worlds; full Document/file/current remain exact');
 const expected=structuredClone(before);
 if(prepared.changes.length){
  expected.revision++;
  for(const change of prepared.changes){
   if(change.change==='subject_bind'){expected.entities[change.entity_ref].subject=structuredClone(change.binding);expected.entities[change.entity_ref].revision=expected.revision;}
   else if(change.change==='relation_bind')expected.relations[change.binding.binding_ref]=structuredClone(change.binding);
  }
 }
 await frame.locator('[data-epi="identity"]').click();
 await frame.locator('.nara-personal-nav').getByRole('button',{name:'Composition',exact:true}).click();
 const bind=frame.getByRole('button',{name:'Bind my seven centres',exact:true});await bind.waitFor({state:'visible',timeout:30000});
 await frame.waitForFunction(()=>{const button=Array.from(document.querySelectorAll('.nara-personal button')).find(value=>value.textContent==='Bind my seven centres');return button&&!button.disabled;},null,{timeout:30000});
 await frame.getByRole('checkbox',{name:'Include Earth grounding',exact:true}).check();
 assert.deepEqual(await nativeDocument(ref),before,'Opening ordinary Composition changes no native source/selection/current');
 const ordinaryReplies=[];
 const clickAndReceive=async(label,expectedChanges)=>{
  const page=frame.page(),started=Date.now(),deadline=started+180000,rows=[],coordinates=new Set(),tracked=new Set();let opens=0,calculatedAck=false,clearedBusy=false,finalOpen=false,editAck=false,finished=false,timer;
  const remaining=()=>{const value=deadline-Date.now();assert.ok(value>0,'Ordinary body binding retains its finite 180s operation bound');return value;};
  let succeed,fail;const received=new Promise((resolve,reject)=>{succeed=resolve;fail=reject;});
  const issued=request=>{
   if(request.method()!=='POST'||new URL(request.url()).pathname!=='/op')return;
   const sent=request.postDataJSON();
   if(sent.op==='nara_identity'&&['open','calculate'].includes(sent.request?.operation)||sent.op==='nara_coordinate'||sent.op==='expression'&&sent.request?.operation==='edit'&&sent.request?.actor==='human:nara-personal-body')tracked.add(request);
  };
  const arrived=async response=>{
   const request=response.request();if(!tracked.has(request)||finished)return;
   try{
    assert.ok(Date.now()<deadline);assert.equal(response.status(),200);const sent=request.postDataJSON(),raw=await response.text();assert.ok(Buffer.byteLength(raw)<=16*1024*1024);
    const result=JSON.parse(raw);assert.equal(result.ok,true);const value=result.outcome?.data;
    if(sent.op==='nara_identity'){
     assert.equal(result.outcome.result,'nara_identity');assert.equal(value.schema,'oi.nara-identity/v1');
     assert.equal(value.reading.person_ref,record.person_ref);assert.equal(value.reading.nara_ref,record.nara_ref);assert.equal(value.reading.input_revision,record.identity_input_revision);
     if(sent.request.operation==='open'){
      assert.deepEqual(value.source,identity.source);opens++;if(coordinates.size===8)finalOpen=true;
     }else{
      assert.deepEqual(value.reading.natal_composition.centre_evidence,calculated.reading.natal_composition.centre_evidence);calculatedAck=true;
      const state=await frame.evaluate(()=>({busy:document.querySelector('.nara-personal-content')?.getAttribute('aria-busy'),notice:Array.from(document.querySelectorAll('.nara-personal-status')).map(node=>node.textContent)}));
      assert.equal(state.busy,'true');assert.ok(state.notice.every(text=>!text?.startsWith('Your seven centres')),'The new operation clears its old success notice before acknowledging new anatomy');clearedBusy=true;
     }
    }else if(sent.op==='nara_coordinate'){
     assert.equal(calculatedAck,true);const expected=originalCoordinateReplies.find(row=>row.request.coordinate_ref===sent.request.coordinate_ref);assert.ok(expected);assert.deepEqual(value,expected.result);coordinates.add(sent.request.coordinate_ref);
    }else{
     assert.deepEqual(sent.request.changes,expectedChanges);assert.ok(value.document);editAck=true;
    }
    rows.push({op:sent.op,operation:sent.request?.operation,request_sha256:sha(request.postData()),response_bytes:Buffer.byteLength(raw),response_sha256:sha(raw),ok:result.ok});
    if(opens>=2&&calculatedAck&&clearedBusy&&coordinates.size===8&&finalOpen&&(expectedChanges.length?editAck:!editAck))succeed();
   }catch(error){fail(error);}
  };
  const failed=request=>{if(tracked.has(request))fail(Error('The ordinary body-binding native request failed: '+request.failure()?.errorText));};
  page.on('request',issued);page.on('response',arrived);page.on('requestfailed',failed);
  timer=setTimeout(()=>fail(Error('The actual new body-binding replies did not complete inside the original 180s operation bound')),remaining());
  try{
   await Promise.all([bind.click({timeout:remaining()}),received]);
   await frame.waitForFunction(()=>document.querySelector('.nara-personal-content')?.getAttribute('aria-busy')==='false'&&Array.from(document.querySelectorAll('.nara-personal-status')).some(value=>value.textContent?.startsWith('Your seven centres and Earth grounding are bound')),null,{timeout:remaining()});
   assert.equal(await frame.locator('.nara-personal [role="alert"]').count(),0);ordinaryReplies.push({label,started,completed:Date.now(),rows});
  }finally{finished=true;clearTimeout(timer);page.off('request',issued);page.off('response',arrived);page.off('requestfailed',failed);}
 };
 await clickAndReceive('first ordinary binding',prepared.changes);
 const after=await nativeDocument(ref);assert.deepEqual(after,expected,'The ordinary button acknowledges exactly the predicted native body binding CAS and preserves the full other Document');
 const repeated=await preparePersonalBodyBindings(read,{...input,document:after});assert.deepEqual(repeated.changes,[]);
 const repeatCreate=await preparePersonalBodyBindings(read,{...input,document:after,earth_entity_ref:undefined,create_earth:{entity_ref:`${ref}:entity:occurrence-${randomUUID()}`}});assert.deepEqual(repeatCreate.changes,[]);
 await clickAndReceive('repeated ordinary binding',[]);
 assert.deepEqual(await nativeDocument(ref),after,'The repeated ordinary binding creates no duplicate subject, Earth or relation');
 await frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();await action('save');
 const saved=await snapshot('14-personal-body-binding-saved',true);
 assert.deepEqual(await savedFile(saved.working,'body-binding-after'),after);
 const afterCurrent=(await op(currentRequest)).data;assert.deepEqual(afterCurrent.context,current.context);assert.deepEqual(afterCurrent.reading,current.reading);
 check(true,'Real ordinary Bind consumes exact native anatomy and Coordinate replies, preserves every existing personal/world layer, reuses Earth, repeats without edits and Saves the same complete native file/current');
 const sources=Object.fromEntries(['expressions-app/field-studies-journeys/src/naraPersonalBody.ts','expressions-app/field-studies-journeys/src/naraInstrument.tsx','expressions-app/field-studies-journeys/src/epiWorldMaterial.ts','expressions-app/field-studies-journeys/src/epiWorldProduction.ts','src/nara/coordinateExpression.ts','kernel/src/nara_coordinate.rs'].map(path=>[path,sha(readFileSync(resolve(root,path)))]));
 const result={schema:'oi.epi-personal-body-native-binding-gate/v1',passed:true,source:sources,checks:negatives,document:after,file:saved.working.file,actual_coordinate_replies:coordinateReplies,ordinary_replies:ordinaryReplies,
  scope:'Actual ordinary constructed same-instance Epi world, native identity/body/Coordinate/current owners, ordinary binding CAS/repeat/Save. Original whole/native-process restart and installed reception remain separate; no model/causal/wave claim.'};
 artifact('actual-personal-body-binding.json',result);return result;
}
