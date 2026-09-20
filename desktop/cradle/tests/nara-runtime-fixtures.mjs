// Controlled fixtures only. No fixture import is reachable from production.
import {readFileSync} from 'node:fs';
import {constitutionFromAikitResolution} from '../src/nara/constitution.ts';
export const fixture=name=>JSON.parse(readFileSync(new URL(`fixtures/nara/${name}`,import.meta.url),'utf8'));
export const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
export function attachment(){
 const context=fixture('nara-dialogue-context-v1.json');context.agent_session_ref='agent-session/nara-test';context.expression_revision='7';
 const resolution=JSON.parse(readFileSync(new URL('../walk/fixtures/nara/text-body-resolution.json',import.meta.url),'utf8')).resolution;
 const constitution=constitutionFromAikitResolution({constitution_ref:'constitution/test',agent_ref:'agent/nara',agency_ref:'agency/nara',world_binding_ref:'world-binding/test',agent_session_ref:context.agent_session_ref,body_ref:'body/test'},resolution,'2026-09-20T00:00:00Z');
 Object.assign(constitution,{input_modalities:['audio','speech','text'],output_modalities:['audio','speech','text'],transport:'http',connection:{kind:'stateless'},
  transforms:{'speech-to-text':{state:'supported'},'text-to-speech':{state:'supported'}},conditions:[],interruption:{state:'unsupported',reason:'controlled request-response service has no provider cancellation'}});
 const dialogue={project:'test-project',space:'session-space/test',agent_session:context.agent_session_ref,provider:'controlled',sender:'agent/operator',expected_binding_revision:'binding:7'};
 const route={endpoint:'http://127.0.0.1:8080/inference',model:'controlled-stt',provider_ref:'provider/test-input',source_ref:'source/route-in',revision:'1'};
 return {schema:'oi.nara-attachment/v1',context,constitution,dialogue,epii:{...dialogue,agent_session:'agent-session/epii-test',agent_ref:'agent/epii'},speech:{kind:'http-stt-text-tts',stt:route,tts:{...route,endpoint:'http://127.0.0.1:8880/v1/audio/speech',model:'controlled-tts',provider_ref:'provider/test-output',source_ref:'source/route-out',voice:'controlled-voice'}}};
}
export function controlledOwner(answer='An actual controlled protocol response.'){
 const requests=[],deliveries=new Map();let sequence=0;
 const owner={requests,deliveries,answer,delay:null,failSend:false,state:'Resident',provider:'controlled',sendCount:0};
 owner.call=async(binding,request)=>{
  requests.push(structuredClone(request));
  if(request.action==='view')return {schema:'aikit.encounter-view/v1',agent_session:binding.agent_session,blocks:[],more:false,draft:{revision:2,text:'untouched human draft'},connection:{resident:true,state:owner.state,error:null,provider:{id:owner.provider,label:'Controlled'}}};
  if(request.action==='reconnect'){owner.state='Resident';return {state:'Resident'};}
  if(request.action==='send'){
   owner.sendCount++;const first=++sequence*10,ref=request.turn.delivery_ref;
   const d={agent_session:binding.agent_session,delivery_ref:ref,sender:binding.sender,phase:'returned',first_cursor:first,terminal_cursor:first+3};
   const text=typeof owner.answer==='function'?owner.answer(request.turn):owner.answer;
   deliveries.set(ref,{d,text});if(owner.failSend)throw new Error('simulated lost acknowledgement');if(owner.delay)await owner.delay.promise;
   return {duplicate:false,transport_accepted:true,delivery:structuredClone(d)};
  }
  if(request.action==='delivery')return structuredClone(deliveries.get(request.delivery_ref)?.d??null);
  if(request.action==='read'){
   const held=[...deliveries.values()].find(({d})=>d.agent_session===binding.agent_session&&request.after>=d.first_cursor&&request.after<d.terminal_cursor);
   if(!held)return {agent_session:binding.agent_session,events:[],next_cursor:request.after,more:false};
   const {d,text}=held;
   return {agent_session:binding.agent_session,events:[
    {cursor:d.first_cursor+1,event:{kind:'provider',delivery_ref:d.delivery_ref,event:{Signal:{kind:{kind:'agent-thought-chunk',text:'PRIVATE THOUGHT NOT TO SPEAK'}}}}},
    {cursor:d.first_cursor+2,event:{kind:'provider',delivery_ref:d.delivery_ref,event:{Signal:{kind:{kind:'agent-message-chunk',text}}}}},
    {cursor:d.first_cursor+3,event:{kind:'provider',delivery_ref:d.delivery_ref,event:{TurnEnded:{stop:{Completed:{}}}}}},
   ].filter(item=>item.cursor>request.after),next_cursor:d.terminal_cursor,more:false};
  }
  throw new Error(`Unimplemented controlled request ${request.action}`);
 };return owner;
}
export function controlledAudio(){
 const events=[];const audio={events,captureWait:null,playWait:null,synthesisWait:null,playing:null,stopped:0,cancelled:0};
 audio.capture=async(signal)=>{events.push('capture');if(audio.captureWait)await audio.captureWait.promise;return {finish:async()=>new Blob(['wav']),cancel:()=>{audio.cancelled++;}};};
 audio.transcribe=async()=>{events.push('transcribe');return 'A spoken question';};
 audio.synthesize=async()=>{events.push('synthesize');if(audio.synthesisWait)await audio.synthesisWait.promise;return new Blob(['wav']);};
 audio.play=async(_wav,signal,onPlaying)=>{events.push('play');audio.playing=onPlaying;if(audio.playWait)await audio.playWait.promise;else onPlaying();if(signal.aborted)throw new DOMException('stopped','AbortError');};
 audio.stop=()=>{audio.stopped++;};return audio;
}
export function expression(context){
 return {schema:'oi.expression/v1',expression_ref:context.expression_ref,revision:7,title:'Controlled',selection:{scene_ref:'scene/test',entity_ref:null},scenes:[{scene_ref:'scene/test',revision:1,title:'Test',entity_refs:['entity/a','entity/b']}],entities:{'entity/a':{entity_ref:'entity/a',title:'A',revision:1,parameters:{},subject:{subject_ref:'bimba:relation:1',native_owner:'ql',presentation_role:'thing',sources:[],readings:[],actions:[]}},'entity/b':{entity_ref:'entity/b',title:'B',revision:1,parameters:{},subject:{subject_ref:'bimba:source:M4.1',native_owner:'ql',presentation_role:'thing',sources:[],readings:[],actions:[]}}},relations:{},provenance:[],representations:[],refinements:[]};
}
