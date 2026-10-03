/** Attributed native quotation material. No transcript, provider or private
 * identity values are accepted from an instrument frame. */
import type {ExpressionDocument,Scene} from '../expression/types';
export interface KeptAnswer {
 schema:'oi.nara-expression-answer/v1';answer_ref:string;act_ref:string;project:string;role:'nara'|'epii';
 agent_session_ref:string;answer_block_ids:number[];question_block_ids:number[];question:string;
 body_sha256:string;primary_sha256:string;source_projection:Record<string,unknown>;
 original_person_ref:string;original_nara_ref:string;identity_source_ref:string;identity_source_revision:string;
 identity_input_revision:string;original_expression_ref:string;original_expression_revision:number;
 epii_review?:Pick<import('./epiiTypes').NativeEpiiReview,'enrichment'|'provenance'>;
 original_scene_ref:string;selected:Record<string,unknown>;event_ref:string;snapshot_ref:string;
 native_current_ref:string;native_current_revision:string;retained_at:string;original_occurred_at:null;
 parts:{scene_ref:string;layer_ids:string[];kind:'primary'|'source'}[];
}
export interface KeptAnswerReading {record:KeptAnswer;body:string;primary:string}
const obj=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('The kept answer has no native material basis.');return v as Record<string,unknown>;
};
export const sameAnswerValue=(a:unknown,b:unknown):boolean=>{
 const stable=(v:unknown):string=>v===null?'null':Array.isArray(v)?`[${v.map(stable).join(',')}]`:typeof v==='object'?`{${Object.keys(v as object).sort().map(k=>`${JSON.stringify(k)}:${stable((v as Record<string,unknown>)[k])}`).join(',')}}`:JSON.stringify(v);
 return stable(a)===stable(b);
};
export async function keptAnswerDigest(value:string):Promise<string>{
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(h)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function keptAnswerCarrier(document:ExpressionDocument):{scene:Scene;world:Record<string,unknown>} {
 const matches=document.scenes.filter(s=>s.presentation?.scene && obj(s.presentation.scene).epiWorld);
 if(matches.length!==1)throw Error('Keep requires one actual Epi world carrier.');
 const scene=matches[0],world=obj(obj(scene.presentation!.scene).epiWorld),receiving=obj(world.receiving),personal=obj(receiving.personal);
 if(world.schema!=='oi.epi-world-material/v1'||receiving.expression_ref!==document.expression_ref
  ||personal.instance_ref!==document.expression_ref||personal.canonical_locus!=='ql:m-coordinate:bimba:M4.4.4.4'
  ||obj(personal.person).ref!==world.person_ref||receiving.subject_ref!==world.person_ref
  ||obj(world.world).event_ref!==receiving.event_ref||obj(world.world).snapshot_ref!==receiving.snapshot_ref
  ||document.entities[String(personal.locus_entity_ref)]?.subject?.subject_ref!==personal.canonical_locus)
  throw Error('The answer destination is not the native Personal Pratibimba world.');
 return {scene,world};
}
function records(document:ExpressionDocument):KeptAnswer[]{
 const {world}=keptAnswerCarrier(document),values=world.kept_answers??[];
 if(!Array.isArray(values)||values.length>64)throw Error('The kept-answer index is outside its native receiving bound.');
 const seen=new Set<string>();
 return values.map(value=>{
  const r=obj(value) as unknown as KeptAnswer;
  if(r.schema!=='oi.nara-expression-answer/v1'||!/^nara-answer-[a-f0-9]{64}$/.test(r.answer_ref)
   ||seen.has(r.answer_ref)||r.original_expression_ref!==document.expression_ref
   ||!['nara','epii'].includes(r.role)||!Array.isArray(r.parts)||!r.parts.length||r.parts.length>5
   ||!Array.isArray(r.answer_block_ids)||!r.answer_block_ids.length||!r.answer_block_ids.every(n=>Number.isSafeInteger(n)&&n>=0)
   ||!Array.isArray(r.question_block_ids)||!r.question_block_ids.length||!r.question_block_ids.every(n=>Number.isSafeInteger(n)&&n>=0)
   ||typeof r.question!=='string'||!r.question.trim()||r.original_occurred_at!==null
   ||!/^\d{4}-\d{2}-\d{2}T/.test(r.retained_at)||!Number.isSafeInteger(r.original_expression_revision)
   ||![r.body_sha256,r.primary_sha256].every(h=>/^[a-f0-9]{64}$/.test(h)))throw Error('The native kept-answer attribution is invalid.');
  for(const k of ['act_ref','project','agent_session_ref','original_person_ref','original_nara_ref','identity_source_ref','identity_source_revision','identity_input_revision','original_scene_ref','event_ref','snapshot_ref','native_current_ref','native_current_revision'] as const)
   if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>4096)throw Error('The native kept answer lost an original source reference.');
  obj(r.source_projection);obj(r.selected);seen.add(r.answer_ref);return r;
 });
}
export async function readKeptAnswers(document:ExpressionDocument):Promise<KeptAnswerReading[]>{
 const allLayers=new Set<string>(),allScenes=new Set<string>(),out:KeptAnswerReading[]=[];
 for(const record of records(document)){
  let primary='',source='';const pageLayers=new Map<string,string[]>();
  for(const part of record.parts){
   if(!part||!['primary','source'].includes(part.kind)||!Array.isArray(part.layer_ids)||!part.layer_ids.length||part.layer_ids.length>16
    ||allScenes.has(part.scene_ref))throw Error('The kept answer has ambiguous native pages.');
   const scenes=document.scenes.filter(s=>s.scene_ref===part.scene_ref);
   if(scenes.length!==1)throw Error('The kept answer’s complete reading Scene is missing.');
   const scene=scenes[0],material=obj(scene.presentation?.scene),layers=material.text;
   if(!scene.body||scene.body.carrier!=='engine_composition'||scene.triggers?.length||!Array.isArray(layers)
     ||layers.length>16)throw Error('The kept answer lost its body or full reading material.');
   let text='';
   for(let i=0;i<part.layer_ids.length;i++){
    const id=part.layer_ids[i],matches=layers.filter(l=>obj(l).id===id);if(matches.length!==1)throw Error('The quoted native text layer is missing or duplicated.');const layer=obj(matches[0]);
    if(typeof id!=='string'||allLayers.has(id)||layer.id!==id||layer.role!==`${record.answer_ref}:${part.kind}`
      ||layer.visible!==true||typeof layer.body!=='string'||layer.body.length>5000||layer.bodySize!==18)
      throw Error('The kept answer’s ordered native text layers changed.');
    allLayers.add(id);text+=layer.body;
   }
   const previous=pageLayers.get(part.scene_ref)??[];pageLayers.set(part.scene_ref,[...previous,...part.layer_ids]);if(part.kind==='primary')primary+=text;else source+=text;
  }
  for(const [ref,ids] of pageLayers){const scene=document.scenes.find(s=>s.scene_ref===ref)!;if(!sameAnswerValue(obj(scene.presentation!.scene).text && (obj(scene.presentation!.scene).text as unknown[]).map(l=>obj(l).id),ids))throw Error('The complete quoted native page order changed.');allScenes.add(ref);}
  const body=record.role==='epii'?source:primary;
  if(!primary.trim()||!body.trim()||await keptAnswerDigest(body)!==record.body_sha256||await keptAnswerDigest(primary)!==record.primary_sha256)
   throw Error('The full native answer or attributed reading changed; its quotation has not been requalified.');
  out.push({record,body,primary});
 }
 return out;
}
export function splitAnswerBody(body:string):string[]{
 if(!body.trim()||new TextEncoder().encode(body).length>256*1024)throw Error('The native answer is outside the bounded complete-body receipt.');
 const out:string[]=[];let start=0;
 while(start<body.length){let end=Math.min(start+5000,body.length);
  if(end<body.length&&body.charCodeAt(end-1)>=0xd800&&body.charCodeAt(end-1)<=0xdbff&&body.charCodeAt(end)>=0xdc00&&body.charCodeAt(end)<=0xdfff)end--;
  out.push(body.slice(start,end));start=end;
 }
 return out;
}

/** Quoted material is confirmed against its completed native immutable Act.
 * This confirms retained body integrity, never a fresh provider invocation. */
export async function verifyStoredAnswerEdition(document:ExpressionDocument,reading:KeptAnswerReading,value:unknown):Promise<void>{
 const act=obj(obj(value).act),sequence=act.sequence;
 if(act.act_ref!==reading.record.act_ref||act.phase!=='completed'||act.return_ref!==reading.record.answer_ref
  ||act.expression_ref!==document.expression_ref||!Array.isArray(sequence)||sequence.length!==2
  ||obj(sequence[0]).kind!=='edition')throw Error('This quotation has no available completed native Edition. Its stored text is preserved; native attribution is unconfirmed.');
 const edition=obj(obj(sequence[0]).edition) as unknown as ExpressionDocument;
 if(edition.schema!=='oi.expression/v1'||edition.expression_ref!==document.expression_ref)
  throw Error('The immutable native answer Edition has a different Expression basis.');
 const original=(await readKeptAnswers(edition)).find(r=>r.record.answer_ref===reading.record.answer_ref);
 if(!original||!sameAnswerValue(original,reading))throw Error('The quotation differs from its original immutable native answer Edition.');
 const withoutSaved=(presentation:Scene['presentation'])=>{
  if(!presentation)return presentation;const {saved:administrativeSaved,...body}=presentation;return body;
 };
 for(const ref of [...new Set(reading.record.parts.map(p=>p.scene_ref))]){
  const old=edition.scenes.find(s=>s.scene_ref===ref),now=document.scenes.find(s=>s.scene_ref===ref);
  if(!old||!now||!sameAnswerValue({...old,revision:now.revision,presentation:withoutSaved(old.presentation)},
   {...now,presentation:withoutSaved(now.presentation)}))throw Error('The kept native reading body changed after its attributed Edition.');
 }
}
