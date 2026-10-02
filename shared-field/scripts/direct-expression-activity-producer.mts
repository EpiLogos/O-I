#!/usr/bin/env node
/** Perform one explicitly admitted Direct turn with Factory's native material
 * and event grammar. The existing Act owns accepted events and resume cursors;
 * the existing publication producer owns the hosted projection. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {decodeBasis,mapEventsWithCursor,opKey,occurrenceKey,wireBasis,type CastMember} from '../../desktop/cradle/src/contributions/factory/live/eventMap';
import {cursorFromAct,performWithRetry,requestFor} from '../../desktop/cradle/src/contributions/factory/live/producer';
import {resolveRepertoire} from '../../desktop/cradle/src/contributions/factory/live/repertoire';
import type {WorldAct,WorldRequest} from '../../desktop/cradle/src/expression/world';
import {nativeExpressionRequest} from './native-expression-transport.mjs';

const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2){
  if(!process.argv[i].startsWith('--')||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Every option requires a value');
  args[process.argv[i].slice(2)]=process.argv[i+1];
}
for(const key of ['act','expression','world','workcell','session','native-session','agent','person','entity','subject','role','from','material','character'])if(!args[key])throw Error('--'+key+' is required');
const from=Number(args.from);
if(!Number.isSafeInteger(from)||from<1)throw Error('from must be the admitted native turn cursor (at least 1)');
const execute=promisify(execFile);
const emit=(event:string,data:unknown={})=>process.stdout.write(JSON.stringify({event,at:new Date().toISOString(),data})+'\n');
const endpoint=args.bridge?new URL('/op',args.bridge):undefined;
if(endpoint&&(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)))throw Error('Native walk bridge must be loopback');
async function native(op:string,request:unknown){
  let envelope:any;
  if(endpoint){const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,request}),signal:AbortSignal.timeout(15000)});envelope=await response.json();}
  else if(args.socket)envelope=await nativeExpressionRequest(args.socket,op==='expression_world'?{schema:'oi.expression-world/v1',...(request as object)}:request);
  else{const body=op==='expression_world'?{schema:'oi.expression-world/v1',...(request as object)}:request;const {stdout}=await execute(args.oi??'oi',['desktop','expression',...(args.socket?[args.socket]:[]),JSON.stringify(body)],{timeout:15000,maxBuffer:4*1024*1024});envelope=JSON.parse(stdout);}
  if(!envelope.ok)throw Error(JSON.stringify(envelope.error??envelope));
  return envelope.outcome.data;
}
const world=(request:WorldRequest)=>native('expression_world',request);
async function gateway(request?:unknown,generation?:string){
  const command=['gateway','--at',args.workcell,'native-owner','--world-ref',args.world,'--json'];
  if(request)command.push('--expected-owner-generation',generation!,'--request-file','-');
  const {stdout}=await new Promise<{stdout:string}>((resolve,reject)=>{
    const child=execFile(args.aikit??'aikit',command,{timeout:15000,maxBuffer:4*1024*1024},(error,stdout)=>error?reject(error):resolve({stdout}));
    child.stdin?.end(request?JSON.stringify(request):undefined);
  });
  const envelope=JSON.parse(stdout);
  if(!envelope.ok)throw Error(JSON.stringify(envelope.error??envelope));
  const reading=envelope.data.reading;
  if(reading.world_ref!==args.world)throw Error('Native owner answered for another World');
  if(request&&(reading.outcome?.result!=='encounter_reading'||!reading.outcome.data))throw Error('Native owner did not return an Encounter reading');
  return reading;
}
async function admittedBody(){
  const owner=await gateway();
  const view=(await gateway({op:'encounter',project:args.project??'',request:{action:'view',agent_session:args.session}},owner.owner_generation)).outcome.data;
  if(view.agent_session!==args.session||view.connection?.native_session_id!==args['native-session'])throw Error('Native session body changed; explicitly readmit the continuing body');
  return owner;
}
const inspect=async():Promise<WorldAct>=>{
  const {act}=await world({operation:'act_inspect',act_ref:args.act});
  if(act.expression_ref!==args.expression||act.mode!=='expressions')throw Error('Direct activity must keep its existing Expressions Act');
  const target=(await native('expression',{operation:'inspect',expression_ref:args.expression})).document;
  if(target.entities[args.entity]?.subject?.subject_ref!==args.subject)throw Error('The target body represents another subject');
  const standing=act.bindings?.[args.role];
  if(standing&&(standing.entity_ref&&standing.entity_ref!==args.entity||standing.agent_ref&&![args.agent,args.world+'/'+args.agent].includes(standing.agent_ref)))throw Error('The standing role belongs to another entity or agent');
  return act;
};
let act=await inspect();
const instrument=act.instrument_ref;
await admittedBody();
let snapshot:any;
if(endpoint)snapshot=await native('shared_field',{kind:'snapshot'});
else{
  const client=args['field-client']??fileURLToPath(new URL('field-client.sh',import.meta.url));
  const value=await new Promise<string>((resolve,reject)=>{const child=execFile(client,[],{timeout:15000,maxBuffer:6*1024*1024},(error,stdout)=>error?reject(error):resolve(stdout));child.stdin?.end(JSON.stringify({kind:'snapshot'}));});
  const envelope=JSON.parse(value);if(!envelope.ok)throw Error('The selected participant could not be read');snapshot=envelope.data;
}
const participant=snapshot.participants?.find((p:any)=>p.participant_ref===args.subject);
if(!participant||participant.identity?.kind!=='agent'||participant.identity.ref!==args.agent||participant.presentation?.world_ref!==args.world)throw Error('The selected body does not disclose this agent in its owning World');
const admittedBindings=args.bindings?JSON.parse(await readFile(args.bindings,'utf8')):{};
if(!admittedBindings||typeof admittedBindings!=='object'||Array.isArray(admittedBindings))throw Error('Bindings must be native Act role bindings');
const doc=(await native('expression',{operation:'inspect',expression_ref:args.expression})).document;
for(const [role,b]of Object.entries(admittedBindings) as [string,any][]){
  if(!b.entity_ref||!doc.entities[b.entity_ref])throw Error('An admitted role has no actual target entity: '+role);
}
const listing=await world({operation:'material_list'});
const repertoire=resolveRepertoire(listing.materials,{explicit:args.material});
if(repertoire.basis!=='explicit')throw Error('The admitted native material is unavailable');
const sessionKey=args.world+'/'+args.session;
const cast:CastMember[]=[{role:args.role,agent_ref:args.agent,label:args.name??'Agent',session_refs:[sessionKey],attempt_refs:[],...(args.profile?{profile_ref:args.profile}:{})}];
const binding={kind:'agent',agent_ref:args.world+'/'+args.agent,label:args.name??'Agent',entity_ref:args.entity,character_ref:args.character,...(args.profile?{profile_ref:args.world+'/'+args.profile}:{})};
for(let attempt=0;attempt<3;attempt++){
  act=await inspect();
  const updates:Record<string,any>={};
  for(const [role,admitted]of Object.entries({...admittedBindings,[args.role]:binding}) as [string,any][]){
    const standing=act.bindings?.[role];
    if(standing?.entity_ref&&standing.entity_ref!==admitted.entity_ref)throw Error('The standing role represents another body: '+role);
    if(standing?.agent_ref&&admitted.agent_ref&&standing.agent_ref!==admitted.agent_ref&&!admitted.agent_ref.endsWith('/'+standing.agent_ref))throw Error('The standing role represents another agent: '+role);
    // Admission supplies identity and material. Current state, text and values
    // belong to the native Act and may have changed concurrently since admission.
    const next={...admitted,...standing,entity_ref:admitted.entity_ref,...(admitted.agent_ref?{agent_ref:admitted.agent_ref}:{}),...(admitted.subject_ref?{subject_ref:admitted.subject_ref}:{})};
    if(JSON.stringify(next)!==JSON.stringify(standing))updates[role]=next;
  }
  const opened=await world({operation:'act_open',act_ref:args.act,mode:'expressions',expression_ref:args.expression,actor:args.actor??args.person,expected_act_revision:act.revision,
    cast:[{role:args.role,participant_ref:args.world+'/'+args.agent,label:args.name??'Agent',character_ref:args.character}],bindings:updates});
  if(['revision_conflict','act_revision_conflict'].includes(opened.state)){if(attempt===2)throw Error('Concurrent admission did not converge');continue;}
  if(!opened.act)throw Error('The native Act admission was not accepted');
  act=opened.act;break;
}
if(act.instrument_ref!==instrument)throw Error('Direct instrument identity changed');
let cursor=cursorFromAct(act),closed=false,stopping=false;
process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
emit('following',{act_ref:args.act,expression_ref:args.expression,world_ref:args.world,session:args.session,from,native_session:args['native-session']});
while(!stopping&&!closed){
  try{
    const owner=await admittedBody();
    act=await inspect();cursor=cursorFromAct(act);
    // Re-read the admitted span, rebuilding ephemeral chunk state from native
    // acceptance. This uses the exact read offered by the owning World and
    // cannot drift into the session's later private work.
    const after=from-1;
    const events:any[]=[];let next=after;
    for(let n=0;n<40;n++){
      const page=(await gateway({op:'encounter',project:args.project??'',request:{action:'read',agent_session:args.session,after:next,limit:256}},owner.owner_generation)).outcome.data;
      if(page.agent_session!==args.session||!Array.isArray(page.events))throw Error('Journal belongs to another session');
      const terminal=page.events.findIndex((e:any)=>e.event?.kind==='provider'&&e.event?.event?.TurnEnded);
      events.push(...(terminal<0?page.events:page.events.slice(0,terminal+1)));
      if(terminal>=0)break;
      if(!page.more)break;
      if(!Number.isSafeInteger(page.next_cursor)||page.next_cursor<=next)throw Error('Native journal cursor did not advance');
      next=page.next_cursor;
      if(n===39)throw Error('Admitted turn exceeds the bounded native journal reading');
    }
    if(!Array.isArray(events)||events.some((e:any,i:number)=>!Number.isSafeInteger(e.cursor)||e.cursor<=after||(i&&e.cursor<=events[i-1].cursor)))throw Error('Native journal is unordered or outside the admitted cursor');
    for(const event of events){
      const provider=event.event?.event;
      const body=provider?.Signal?.native_session_id??provider?.TurnEnded?.binding?.native_session_id;
      if(body&&body!==args['native-session'])throw Error('Journal contains another provider body; readmit it before performing');
    }
    const confirmedOwner=await admittedBody();
    if(confirmedOwner.owner_generation!==owner.owner_generation)throw Error('Native owner changed while acquiring the turn');
    const end=events.findIndex((e:any)=>e.event?.kind==='provider'&&e.event?.event?.TurnEnded);
    const admitted=end<0?events:events.slice(0,end+1);
    const reconstructed={...cursor,encounterAfter:{...cursor.encounterAfter,[sessionKey]:from-1},sessions:{}};
    const mapped=mapEventsWithCursor({runRef:args.expression},{encounter:{[sessionKey]:admitted},bounds:{[sessionKey]:{from,to:admitted.at(-1)?.cursor??after}}},reconstructed,{cast,humanRefs:{[sessionKey]:args.world+'/'+args.person},replyRole:'resultText',replyChars:4096,messageRole:'communication',worldRef:args.world,phaseScenes:{working:'work-passage',speaking:'review',idle:'continuation'}});
    for(const op of mapped.ops){
      act=await inspect();const accepted=cursorFromAct(act);
      if(accepted.performed.includes(opKey(op)))continue;
      const resolved=requestFor(op,repertoire,[{...cast[0],character_ref:args.character}],{actRef:args.act,actor:args.actor??args.person});
      if(!resolved.request)throw Error(resolved.reason);
      const request:any={...resolved.request,expected_act_revision:act.revision};
      if(request.bindings){for(const [role,value]of Object.entries(request.bindings) as [string,any][]){
        if(value.agent_ref===args.agent)request.bindings[role]={...value,...binding,state:value.state};
        else if(admittedBindings[role]?.entity_ref)request.bindings[role]={...value,entity_ref:admittedBindings[role].entity_ref};
      }}
      try{await performWithRetry(world,request,args.act);}
      catch(error){
        // Lost replies may follow an accepted effect. Only its exact native
        // passage proves acceptance; an unreadable Act never permits resend.
        const recovered=await inspect();
        if(!cursorFromAct(recovered).performed.includes(opKey(op)))throw error;
      }
      act=await inspect();
      if(!cursorFromAct(act).performed.includes(opKey(op)))throw Error('Native Act has no acceptance passage for '+JSON.stringify(wireBasis(op.basis)));
      if(op.operation==='act_text'&&!act.sequence.some(p=>{const b=decodeBasis(p.event_basis);return b&&occurrenceKey(b.event_ref,b.occurrence)===opKey(op)&&p.target_scene_ref;}))throw Error('The returned text has no performed native scene layer');
      emit('performed',{operation:op.operation,key:opKey(op),act_revision:act.revision,basis:wireBasis(op.basis)});
    }
    // Open chunk text is ephemeral reconstruction from its first cursor; no
    // second writable checkpoint advances past native Act acceptance.
    cursor=cursorFromAct(act);
    closed=end>=0;
    if(closed)emit('turn-retained',{act_revision:act.revision,effects_replayed:false});
  }catch(error){emit('unavailable',{message:String(error)});process.exitCode=1;break;}
  if(!closed&&!stopping)await new Promise(resolve=>setTimeout(resolve,750));
}
emit('stopped',{closed,interrupted:stopping});
