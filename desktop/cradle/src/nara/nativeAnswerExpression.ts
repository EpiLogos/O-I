/** Keep a verified completed native turn in its existing saved Expression.
 * One atomic native edit/Edition, exact file CAS, no provider invocation. */
import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {ExpressionDocument,ExpressionRequest,ExpressionResult,Change,Scene} from '../expression/types';
import {worldOp,type ActOutcome} from '../expression/world';
import {answerId,verifyNativeAnswer,type NativeAnswer} from './nativeReturn';
import {keptAnswerCarrier,readKeptAnswers,verifyStoredAnswerEdition,splitAnswerBody,keptAnswerDigest,sameAnswerValue,type KeptAnswer,type KeptAnswerReading} from './nativeKeptAnswer';
import type {NativeExpressionAnswerReceipt} from './instrumentProtocol';
type ObjectValue=Record<string,unknown>;
const obj=(v:unknown):ObjectValue=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('The answer requires a complete native source basis.');return v as ObjectValue;};
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const busy=new Set<string>(),uncertain=new Set<string>();
async function expression(t:KernelTransportStatus,request:ExpressionRequest):Promise<ExpressionResult>{
 const r=await kernelOp(t,{op:'expression',request});if(r.error||r.outcome?.result!=='expression')throw Error(r.error??'The native Expression owner did not answer.');return r.outcome.data as ExpressionResult;
}
export async function readNativeAnswerExpression(t:KernelTransportStatus,ref:string):Promise<{document:ExpressionDocument;file:NonNullable<ExpressionResult['file']>}> {
 const result=await expression(t,{operation:'inspect',expression_ref:ref});
 if(result.document?.schema!=='oi.expression/v1'||result.document.expression_ref!==ref||!result.file
  ||result.file.location.schema!=='central.path-ref/v1'||!result.file.revision||result.dirty!==false)
  throw Error('Save this native Expression before keeping its answer. Unsaved or unconfirmed work was preserved.');
 const read=await expression(t,{operation:'inspect_file',location:result.file.location,expected_file_revision:result.file.revision});
 if(!read.document||!sameAnswerValue(read.document,result.document))throw Error('The saved native file does not match this exact Expression.');
 return {document:result.document,file:result.file};
}
function sceneMaterial(scene:Scene):ObjectValue{return obj(scene.presentation?.scene);}
function currentProjection(input:ObjectValue):ObjectValue {
 const scene=obj(input.selected_scene_native_basis),source=obj(input.selected_source_basis);
 return {selected_source_basis:source,selected_source_relation:input.selected_source_relation??null,
  selected_scene_native_basis:{schema:scene.schema,instance_ref:scene.instance_ref,person_ref:scene.person_ref,
   event_ref:scene.event_ref,snapshot_ref:scene.snapshot_ref,selected_scene_ref:scene.selected_scene_ref,source_basis:scene.source_basis}};
}
export async function planNativeAnswerExpression(document:ExpressionDocument,answer:NativeAnswer,currentInput:ObjectValue):Promise<{record:KeptAnswer;changes:Change[];scenes:Scene[];existing:KeptAnswerReading|null}> {
 const {scene:cosmic,world}=keptAnswerCarrier(document),receiving=obj(world.receiving),personal=obj(receiving.personal),context=answer.basis.context;
 const id=await answerId(answer),existing=(await readKeptAnswers(document)).find(r=>r.record.answer_ref===id)??null;
 const original=answer.basis.expression,projection=currentProjection(currentInput),originalProjection=answer.basis.source_projection;
 const current=obj(context.personal_current),sceneBasis=obj(projection.selected_scene_native_basis);
 if(original.ref!==document.expression_ref||(!existing&&original.revision!==document.revision)
  ||answer.dialogue.binding.expression_ref!==document.expression_ref||context.subject_ref!==world.person_ref||context.nara_ref!==world.nara_ref
  ||answer.basis.identity_source.source_ref!==obj(world.identity_source).source_ref||answer.basis.identity_source.revision!==obj(world.identity_source).revision
  ||answer.basis.input_revision!==world.identity_input_revision||current.event_ref!==receiving.event_ref
  ||current.identity_source_ref!==obj(world.identity_source).source_ref||current.identity_revision!==obj(world.identity_source).revision
  ||sceneBasis.schema!=='oi.selected-scene-native-basis/v1'||sceneBasis.instance_ref!==document.expression_ref
  ||sceneBasis.person_ref!==world.person_ref||sceneBasis.event_ref!==receiving.event_ref||sceneBasis.snapshot_ref!==receiving.snapshot_ref
  ||sceneBasis.selected_scene_ref!==document.selection.scene_ref
  ||!sameAnswerValue(answer.basis.selected,currentInput.selected)||!sameAnswerValue(originalProjection,projection)
  ||!sameAnswerValue(context.personal_current,obj(currentInput.context).personal_current))
  throw Error('The completed answer does not belong to this exact current person, source, selection and cosmic occasion.');
 const primary=answer.epii?.enrichment.synthesis??answer.answer;
 const bodyHash=await keptAnswerDigest(answer.answer),primaryHash=await keptAnswerDigest(primary);
 if(existing){
  if(existing.body!==answer.answer||existing.primary!==primary||!sameAnswerValue(existing.record.epii_review,answer.epii)||existing.record.body_sha256!==bodyHash
   ||!sameAnswerValue(existing.record.source_projection,projection))throw Error('This retained answer was edited. Its authored material was preserved.');
  return {record:existing.record,changes:[],scenes:[],existing};
 }
 const memberRefs=personal.centre_entity_refs;
 if(!Array.isArray(memberRefs)||memberRefs.length!==7||new Set(memberRefs).size!==7)throw Error('The complete seven-centre native personal body is unavailable.');
 const personalScenes=document.scenes.filter(s=>s.scene_ref!==cosmic.scene_ref&&s.entity_refs.length===9&&memberRefs.every(r=>s.entity_refs.includes(String(r)))&&s.entity_refs.includes(String(personal.locus_entity_ref)));
 // A later reading scene is not a replacement personal template.
 const personalScene=personalScenes.find(s=>!((sceneMaterial(s).text as ObjectValue[]|undefined)?.some(l=>String(l.role??'').startsWith('nara-answer-'))));
 if(!personalScene?.body||personalScene.body.carrier!=='engine_composition'||personalScene.triggers?.length)throw Error('The actual personal EngineComposition is not qualified for an attributed reading.');
 const content=[...splitAnswerBody(primary).map(body=>({kind:'primary' as const,body})),
  ...(answer.dialogue.role==='epii'?splitAnswerBody(answer.answer).map(body=>({kind:'source' as const,body})):[])];
 if(content.length>64||new TextEncoder().encode(primary+(answer.dialogue.role==='epii'?answer.answer:'')).length>256*1024)
  throw Error('The complete native answer exceeds the four-Scene receiving budget. Nothing was omitted.');
 if(document.scenes.length+Math.ceil(content.length/16)>64)throw Error('This native world cannot receive every answer page within its Scene budget.');
 const title=`${answer.dialogue.role==='epii'?'Epii':'Nara'} · ${Array.from(answer.question.replace(/\s+/g,' ')).slice(0,108).join('')}`;
 const record:KeptAnswer={schema:'oi.nara-expression-answer/v1',answer_ref:id,act_ref:`act:${id}`,project:answer.dialogue.project,role:answer.dialogue.role,
  agent_session_ref:answer.dialogue.provisioning.agent_session,answer_block_ids:[...answer.answerBlockIds],question_block_ids:[...answer.questionBlockIds],question:answer.question,
  body_sha256:bodyHash,primary_sha256:primaryHash,source_projection:copy(projection),original_person_ref:String(world.person_ref),original_nara_ref:String(world.nara_ref),
  identity_source_ref:String(answer.basis.identity_source.source_ref),identity_source_revision:String(answer.basis.identity_source.revision),identity_input_revision:answer.basis.input_revision,
  original_expression_ref:document.expression_ref,original_expression_revision:document.revision,original_scene_ref:document.selection.scene_ref,selected:copy(answer.basis.selected),
  event_ref:String(receiving.event_ref),snapshot_ref:String(receiving.snapshot_ref),native_current_ref:String(current.reading_ref),native_current_revision:String(current.reading_revision),
  retained_at:new Date().toISOString(),original_occurred_at:null,parts:[]};
 if(answer.epii)record.epii_review=copy(answer.epii);
 const changes:Change[]=[],scenes:Scene[]=[];
 for(let offset=0;offset<content.length;offset+=16){
  const page=offset/16,ref=`scene:${id}:${page+1}`,pageTitle=`${title}${content.length>16?` · ${page+1}`:''}`;
  if(document.scenes.some(s=>s.scene_ref===ref))throw Error('A native reading Scene already occupies this answer reference.');
  const rows=content.slice(offset,offset+16),layers=rows.map((row,i)=>({id:`${id}:${offset+i}`,role:`${id}:${row.kind}`,visible:true,
   kicker:i===0?`${answer.dialogue.role==='epii'?'Epii':'Nara'} · historical native quotation`:'',title:i===0?pageTitle:'',italic:'',body:row.body,bodySize:18,x:.04,y:.08,width:680,size:24,align:'left'}));
  const material=copy(sceneMaterial(personalScene));material.id=ref;material.name=pageTitle;material.text=layers;
  delete material.epiWorld;delete material.research;delete material.triggers;
  const made:Scene={scene_ref:ref,revision:0,title:pageTitle,entity_refs:[...personalScene.entity_refs],body:copy(personalScene.body),triggers:[],presentation:{schema:'oi.journey-scene/v1',scene:material}};
  scenes.push(made);changes.push({change:'scene_create',scene_ref:ref,title:pageTitle},{change:'scene_compose',scene_ref:ref,entity_refs:made.entity_refs},
   {change:'scene_material_set',scene_ref:ref,presentation:made.presentation!},{change:'scene_body_set',scene_ref:ref,body:made.body!});
  for(let i=0;i<rows.length;){let end=i+1;while(end<rows.length&&rows[end].kind===rows[i].kind)end++;
   record.parts.push({scene_ref:ref,layer_ids:layers.slice(i,end).map(l=>l.id),kind:rows[i].kind});i=end;}
 }
 const index=world.kept_answers??[];if(!Array.isArray(index)||index.length>=64)throw Error('The existing native answer register is full.');
 const presentation=copy(cosmic.presentation!);obj(presentation.scene).epiWorld={...world,kept_answers:[...index,record]};
 changes.push({change:'scene_material_set',scene_ref:cosmic.scene_ref,presentation});
 return {record,changes,scenes,existing:null};
}
export function verifyAnswerWorldConservation(before:ExpressionDocument,after:ExpressionDocument,record:KeptAnswer,scenes:Scene[]):void {
 const original=copy(before),actual=copy(after);original.revision=actual.revision;
 const oldCarrier=keptAnswerCarrier(original),newCarrier=keptAnswerCarrier(actual);
 oldCarrier.scene.revision=newCarrier.scene.revision;oldCarrier.world.kept_answers=newCarrier.world.kept_answers;
 if(!sameAnswerValue(actual.scenes.slice(0,before.scenes.length),original.scenes)||actual.scenes.length!==before.scenes.length+scenes.length)
  throw Error('Native answer reception changed an original Scene or omitted reading material.');
 for(const scene of scenes){const received=actual.scenes.find(s=>s.scene_ref===scene.scene_ref),expected=copy(scene);if(!received)throw Error('The new native reading body is missing.');expected.revision=received.revision;
  if(!sameAnswerValue(expected,received))throw Error('The acknowledged native reading differs from its complete submitted body.');}
 actual.scenes=original.scenes;if(!sameAnswerValue(original,actual))throw Error('Answer reception changed original entities, subjects, profiles, relations, selection or provenance.');
 const prior=(keptAnswerCarrier(before).world.kept_answers??[]) as KeptAnswer[];
 if(!sameAnswerValue(newCarrier.world.kept_answers,[...prior,record]))throw Error('The native answer index changed another attributed return.');
}
export async function keepNativeAnswerInExpression(t:KernelTransportStatus,answer:NativeAnswer,currentInput:ObjectValue,assertCurrent:()=>void):Promise<NativeExpressionAnswerReceipt>{
 const ref=answer.dialogue.binding.expression_ref,id=await answerId(answer),key=`${ref}:${id}`;
 if(busy.has(key))throw Error('This native answer is already being kept.');busy.add(key);
 try{
  assertCurrent();await verifyNativeAnswer(t,answer);assertCurrent();
  const basis=await readNativeAnswerExpression(t,ref);assertCurrent();
  const plan=await planNativeAnswerExpression(basis.document,answer,currentInput);assertCurrent();
  let revision=basis.document.revision,already=!!plan.existing;
  if(!already){
   if(uncertain.has(key))throw Error('The earlier native Keep remains unconfirmed. No edit or provider turn was resent. Read the existing world and Act.');
   // A missing earlier Act receipt cannot authorize another perform.
   const prior=await worldOp(t,{operation:'act_inspect',act_ref:plan.record.act_ref}) as ActOutcome;assertCurrent();
   if(prior.act)throw Error('This answer already has a native Act. Inspect its existing edition before continuing; no perform was repeated.');
   uncertain.add(key);
   const applied=await worldOp(t,{operation:'act_perform',act_ref:plan.record.act_ref,expression_ref:ref,expected_revision:revision,
    summary:'Keep completed native answer in this Expression',actor:'human:nara-answer-keep',changes:plan.changes}) as ActOutcome;
   if(applied.state!=='act_running'||!applied.act){
    const unchanged=await expression(t,{operation:'inspect',expression_ref:ref});
    if(unchanged.document&&sameAnswerValue(unchanged.document,basis.document))uncertain.delete(key);
    throw Error(`Native Keep refused: ${applied.state}. No body was discarded.`);
   }
   const result=await expression(t,{operation:'inspect',expression_ref:ref});if(!result.document)throw Error('The native Keep acknowledgement has no current Document.');
   verifyAnswerWorldConservation(basis.document,result.document,plan.record,plan.scenes);revision=result.document.revision;
   const read=(await readKeptAnswers(result.document)).find(r=>r.record.answer_ref===id);
   if(!read||read.body!==answer.answer)throw Error('The actual native reading does not contain the complete answer.');
   if(applied.act.sequence.length!==1||applied.act.sequence[0].kind!=='edition'||!sameAnswerValue(applied.act.sequence[0].edition,result.document))
    throw Error('The native Act did not retain the complete immutable answer world.');
   const completed=await worldOp(t,{operation:'act_complete',act_ref:plan.record.act_ref,expected_act_revision:applied.act.revision,
    expected_revision:revision,actor:'human:nara-answer-keep',return_ref:id}) as ActOutcome;
   if(completed.state!=='act_completed'||completed.act?.return_ref!==id)throw Error('The answer world was committed but its native Act completion is unconfirmed. Inspect before retrying.');
   uncertain.delete(key);
  }
  const receipt:NativeExpressionAnswerReceipt={schema:'oi.nara-expression-answer-receipt/v1',answer_ref:id,act_ref:plan.record.act_ref,
   expression_ref:ref,previous_revision:basis.document.revision,revision,scene_refs:[...new Set(plan.record.parts.map(p=>p.scene_ref))],
   body_sha256:plan.record.body_sha256,already,state:'native-kept-file-unconfirmed',file:basis.file};
  try{
   if(already){
    const act=await worldOp(t,{operation:'act_inspect',act_ref:plan.record.act_ref}) as ActOutcome;
    // A repeated Keep authenticates the entire retained attribution/body,
    // not only a completed Act header. The native transcript was reverified above.
    await verifyStoredAnswerEdition(basis.document,plan.existing!,act);
    receipt.state='saved';return receipt;
   }
   const saved=await expression(t,{operation:'save',expression_ref:ref,expected_revision:revision,location:basis.file.location,expected_file_revision:basis.file.revision,actor:'human:nara-answer-keep',actor_kind:'human'});
   if(saved.state!=='saved'||!saved.file||!sameAnswerValue(saved.file.location,basis.file.location))throw Error('The same-file native save was not confirmed.');
   const live=await expression(t,{operation:'inspect',expression_ref:ref}),disk=await expression(t,{operation:'inspect_file',location:saved.file.location,expected_file_revision:saved.file.revision});
   if(!live.document||live.document.revision!==revision||live.dirty!==false||!sameAnswerValue(live.document,disk.document))throw Error('The complete saved native answer world was not read back.');
   receipt.state='saved';receipt.file=saved.file;return receipt;
  }catch(error){receipt.error=String(error);return receipt;}
 }finally{busy.delete(key);}
}

/** Rehashed imported metadata is not a native answer. Confirm the completed
 * owner-retained immutable Edition without acquiring/reinvoking a provider. */
export async function readStoredNativeAnswers(t:KernelTransportStatus,document:ExpressionDocument):Promise<KeptAnswerReading[]>{
 const readings=await readKeptAnswers(document);
 for(const reading of readings)await verifyStoredAnswerEdition(document,reading,
  await worldOp(t,{operation:'act_inspect',act_ref:reading.record.act_ref}));
 return readings;
}
