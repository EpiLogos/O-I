#!/usr/bin/env node
/** Read one real native Expression/Act and project changed material through one
 * standing hosted connection. Reads never invoke an Act, agent or tool. */
import {existsSync,readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {projectExpression,hostedExpressionArgs} from '../expression-projection.mjs';
import {advanceSharedStage} from '../shared-stage.mjs';
import {createExploreEntry} from '../explore.mjs';
import {nativeExpressionRequest} from './native-expression-transport.mjs';

const args={};
for(let i=2;i<process.argv.length;i+=2){
  const key=process.argv[i],value=process.argv[i+1];
  if(!key.startsWith('--')||!value||value.startsWith('--'))throw Error('Every option requires a value');
  args[key.slice(2)]=value;
}
for(const key of ['publication','act','activity-ref'])if(!args[key])throw Error('--'+key+' is required');
if(args.bridge&&args['native-socket'])throw Error('Select one native owner transport');
const endpoint=args.bridge?new URL('/op',args.bridge):null;
if(endpoint&&(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)))throw Error('The native walk bridge must be loopback HTTP');
const execute=promisify(execFile);
const interval=Number(args['interval-ms']??1000);
if(!Number.isSafeInteger(interval)||interval<200)throw Error('interval-ms must be an integer >=200');
const initial=JSON.parse(readFileSync(args.publication,'utf8'));
const expressionRef=initial.composition.expression_ref,fieldRef=initial.field_ref;
// A continuation reads the actual Central Location used by native Save/OpenFile.
// No retained publication or worker checkpoint becomes a writable document.
const sourceLocation=args['source-location']?JSON.parse(readFileSync(args['source-location'],'utf8')):undefined;
if(sourceLocation&&(sourceLocation.schema!=='central.path-ref/v1'||!sourceLocation.root||!sourceLocation.path||!sourceLocation.ref))throw Error('source-location must be a native Central Location');
const emit=value=>process.stdout.write(JSON.stringify({at:new Date().toISOString(),...value})+'\n');
for(const level of ['log','info','warn','debug'])console[level]=(...parts)=>process.stderr.write(parts.join(' ')+'\n');
const installedLibrary=new URL('./field-lib.mjs',import.meta.url);
let lib;
if(existsSync(installedLibrary))lib=await import(installedLibrary.href);
else{
  const moduleDir=join(dirname(fileURLToPath(import.meta.url)),'..','spacetimedb');
  const sourceRequire=createRequire(join(moduleDir,'package.json'));
  const {tsImport}=await import(pathToFileURL(sourceRequire.resolve('tsx/esm/api')).href);
  lib=await tsImport(pathToFileURL(join(moduleDir,'field-lib.ts')).href,import.meta.url);
}
const binding=lib.resolveTarget();if(!binding.bound)throw Error(binding.reason);
let client,stopping=false,timer,removeLifecycle;
function releaseConnection(){
  removeLifecycle?.();removeLifecycle=undefined;
  if(client){const prior=client;client=undefined;lib.close(prior);}
}
async function readOwner(op,request){
  let value;
  if(endpoint){
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,request}),signal:AbortSignal.timeout(15000)});
    value=await response.json();
  }else if(args['native-socket']){
    value=await nativeExpressionRequest(args['native-socket'],op==='expression_world'?{schema:'oi.expression-world/v1',...request}:request);
  }else{
    // The installed application's existing permission-bounded Expression
    // socket fronts its one native kernel. Never start another application or
    // reconstruct owner state from files. The world schema routes Act reads.
    const body=op==='expression_world'?{schema:'oi.expression-world/v1',...request}:request;
    const command=['desktop','expression',...(args['native-socket']?[args['native-socket']]:[]),JSON.stringify(body)];
    const {stdout}=await execute(args['oi-bin']??process.env.OI_BIN??'oi',command,{timeout:15000,maxBuffer:1024*1024,encoding:'utf8'});
    value=JSON.parse(stdout);
  }
  if(!value.ok||value.outcome?.result==='unavailable')throw Error(value.error??'Native owner unavailable');
  return value.outcome.data;
}
async function beat(connection){
  try{
    let ownerDocument;
    try{ownerDocument=await readOwner('expression',{operation:'inspect',expression_ref:expressionRef});}
    catch(error){
      if(!sourceLocation||!String(error?.message??error).includes('Expression is not open'))throw error;
      ownerDocument=await readOwner('expression',{operation:'open_file',location:sourceLocation,actor:args.actor??initial.participant.identity.ref});
      if(ownerDocument.state!=='ready')throw Error('The source document could not be resumed');
    }
    const document=ownerDocument.document;
    const act=(await readOwner('expression_world',{operation:'act_inspect',act_ref:args.act})).act;
    if(stopping||connection!==client||connection.lifecycle.status().state!=='available')return;
    if(document?.expression_ref!==expressionRef||act?.act_ref!==args.act||act.expression_ref!==expressionRef)throw Error('Native owner answered for a different subject');
    if(args['activity-ref']!==`${initial.world_ref}/${act.act_ref}`)throw Error('The activity identity must qualify the actual native Act with its source World');
    if(!Number.isSafeInteger(act.revision)||act.revision<1||!['running','held','completed','cancelled'].includes(act.phase))throw Error('Native Act has no supported revision/phase');
    // This activity was deliberately admitted by its World publisher. The
    // producer may refresh that exact owner reading, never invent a nearby
    // activity or use the document's independent revision as the Act's.
    const activityRow=lib.rows(connection.conn.db.exploreEntry).find(row=>row.semanticRef===args['activity-ref']&&row.fieldRef===fieldRef&&row.worldRef===initial.world_ref);
    if(!activityRow)throw Error('The native Act has no admitted activity entry');
    const activity=JSON.parse(activityRow.entryJson);
    if(activity.kind!=='activity'||activity.meta?.native_owner!=='o-i'||activity.meta.native_activity_ref!==act.act_ref||activity.meta.expression_ref!==expressionRef)throw Error('The admitted activity names a different native owner or Act');
    const publishedActRevision=Number(activity.revision);
    if(!Number.isSafeInteger(publishedActRevision)||publishedActRevision<1)throw Error('The admitted activity has no native owner revision');
    if(publishedActRevision>act.revision||Number(activity.meta.owner_revision)>act.revision)throw Error('The native Act is behind its hosted reading');
    if(publishedActRevision===act.revision&&activity.meta.owner_state!==act.phase)throw Error('The same native Act revision carries a conflicting owner state');
    if(activity.revision!==String(act.revision)||activity.meta.owner_revision!==act.revision||activity.meta.owner_state!==act.phase){
      const next=createExploreEntry({...activity,revision:String(act.revision),provenance:activity.provenance.map(source=>source.source_system==='o-i'&&source.ref===act.act_ref?{...source,revision:String(act.revision)}:source),meta:{...activity.meta,owner_revision:act.revision,owner_state:act.phase,state:act.phase,source_revision:String(act.revision)}});
      const entryJson=JSON.stringify(next);
      await connection.conn.reducers.putExploreEntry({semanticRef:next.ref,worldRef:next.world_ref,fieldRef,kind:next.kind,label:next.label,revision:next.revision,entryJson});
      await lib.waitUntil(()=>lib.rows(connection.conn.db.exploreEntry).some(row=>row.semanticRef===next.ref&&row.fieldRef===fieldRef&&row.entryJson===entryJson),'the exact native Act reading');
      emit({event:'activity-published',activity_ref:next.ref,owner_revision:act.revision,owner_state:act.phase,expression_revision:document.revision});
    }
    if(sourceLocation){
      if(JSON.stringify(ownerDocument.file?.location)!==JSON.stringify(sourceLocation)){
        // Location object key order is immaterial; identity is every native field.
        if(!['schema','ref','root','path'].every(key=>ownerDocument.file?.location?.[key]===sourceLocation[key]))throw Error('The open document is bound to another source');
      }
      if(ownerDocument.dirty){
        const saved=await readOwner('expression',{operation:'save',expression_ref:expressionRef,expected_revision:document.revision,location:sourceLocation,expected_file_revision:ownerDocument.file.revision,actor:args.actor??initial.participant.identity.ref,actor_kind:args['actor-kind']??'agent'});
        if(saved.state!=='saved'||!saved.persisted||!saved.readback_verified)throw Error('The changed native document has no verified source save');
        emit({event:'source-saved',expression_revision:document.revision,file_revision:saved.file.revision});
      }
    }
    const prior=lib.rows(connection.conn.db.projection).filter(row=>row.projectionRef===initial.projection.projection_ref).sort((a,b)=>Number(b.projectionRevision)-Number(a.projectionRevision))[0];
    if(!prior)throw Error('Recover the admitted publication before starting its producer');
    if(Number(prior.sourceRevision)>document.revision)throw Error('Native owner is behind the retained hosted source revision');
    let presentationRevision=Number(prior.projectionRevision);
    const hostedEntry=lib.rows(connection.conn.db.exploreEntry).find(row=>row.semanticRef===expressionRef&&row.fieldRef===fieldRef);
    const activityBound=hostedEntry&&JSON.parse(hostedEntry.entryJson).meta?.activity_ref===args['activity-ref'];
    if(String(document.revision)!==prior.sourceRevision||!activityBound){
      const field=lib.fieldSnapshot(connection).fields.find(row=>row.field_ref===fieldRef);
      if(!field)throw Error('The admitted field contract is unavailable');
      const publication=projectExpression({document,world_ref:initial.world_ref,activity_ref:args['activity-ref'],field_ref:fieldRef,field,projection_ref:initial.projection.projection_ref,projection_revision:Number(prior.projectionRevision)+1,presentation_ref:initial.presentation.presentation_ref,publisher:{participant_ref:initial.participant.participant_ref,identity_ref:initial.participant.identity.ref,chosen_name:initial.participant.presentation?.chosen_name},audience:initial.projection.audience,selection:{include_scene_material:true,include_source_refs:initial.composition.provenance.map(source=>source.ref).concat(Object.values(initial.composition.entities).flatMap(entity=>entity.subject?.sources.map(source=>source.ref)??[])),summary:initial.entry.summary},published_at:new Date().toISOString()});
      await lib.publishArgs(connection,hostedExpressionArgs(publication));
      presentationRevision=publication.projection.projection_revision;
      emit({event:'published',expression_ref:expressionRef,source_revision:document.revision,projection_revision:publication.projection.projection_revision,act_revision:act.revision});
    }
    // Follow only the stage explicitly attached to this producer's Act. A
    // different presenter/subject retains its own cursor and cannot be moved
    // by this publication worker. Reconcile after a reconnect or interrupted
    // publish as well as after a new document revision.
    if(stopping||connection!==client||connection.lifecycle.status().state!=='available')return;
    const stageRow=lib.rows(connection.conn.db.sharedStage).find(row=>row.fieldRef===fieldRef);
    const stage=stageRow&&JSON.parse(stageRow.contractJson);
    if(stage?.state==='open'&&stage.presenter_ref===initial.participant.participant_ref&&
       stage.subject_ref===expressionRef&&stage.causal?.ref===args['activity-ref']&&
       stage.presentation?.ref===initial.presentation.presentation_ref&&
       (stage.expression?.revision!==document.revision||stage.presentation.revision!==presentationRevision)){
      const next=advanceSharedStage(stage,{expression:{ref:expressionRef,revision:document.revision},presentation:{ref:initial.presentation.presentation_ref,revision:presentationRevision},scene_ref:document.selection.scene_ref},{expected_revision:stage.revision,presenter_ref:stage.presenter_ref});
      await connection.conn.reducers.advanceSharedStage({fieldRef,stageRef:stage.shared_stage_ref,actorParticipantRef:stage.presenter_ref,expectedRevision:BigInt(stage.revision),contractJson:JSON.stringify(next)});
      emit({event:'stage-advanced',stage_ref:stage.shared_stage_ref,stage_revision:next.revision,expression_revision:document.revision,presentation_revision:presentationRevision});
    }
    if(stopping||connection!==client||connection.lifecycle.status().state!=='available')return;
    await connection.conn.reducers.putActivityLiveness({fieldRef,activityRef:args['activity-ref'],producerParticipantRef:args.participant??initial.participant.participant_ref,ownerState:act.phase,ownerRevision:BigInt(act.revision)});
    emit({event:'beat',act_ref:act.act_ref,owner_state:act.phase,owner_revision:act.revision,expression_revision:document.revision});
  }catch(error){emit({event:'owner-unreadable',message:String(error?.message??error)});}
}
async function stop(signal){
  if(stopping)return;stopping=true;clearTimeout(timer);
  try{if(client)await Promise.race([client.conn.reducers.clearActivityLiveness({fieldRef,activityRef:args['activity-ref']}),new Promise((_,reject)=>setTimeout(()=>reject(Error('clear timed out')),2000))]);}catch(error){emit({event:'clear-failed',message:String(error?.message??error)});}
  releaseConnection();emit({event:'stopped',signal});process.exit(0);
}
process.once('SIGTERM',()=>void stop('SIGTERM'));process.once('SIGINT',()=>void stop('SIGINT'));
async function loop(){
  if(stopping)return;
  if(client&&client.lifecycle.status().state!=='available')releaseConnection();
  if(!client){
    try{
      const opened=await lib.open(binding.target,args['token-label']??'owner');
      if(stopping){lib.close(opened);return;}
      client=opened;
      removeLifecycle=opened.lifecycle.subscribe(event=>{if(!stopping&&['offline','error'].includes(event.transport.state))emit({event:'disconnected',transport:event.transport.state});});
      emit({event:'connected',field_ref:fieldRef,expression_ref:expressionRef,act_ref:args.act,pid:process.pid,transport_identity:opened.identityHex,owner_transport:endpoint?'native-walk-bridge':'installed-expression-application'});
    }catch(error){emit({event:'connect-failed',message:String(error?.message??error)});}
  }
  if(client)await beat(client);
  if(!stopping)timer=setTimeout(loop,interval);
}
await loop();
