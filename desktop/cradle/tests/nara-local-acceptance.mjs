#!/usr/bin/env node
/** Opt-in live acceptance, using the production adapter and existing native
 * session. No installation, session creation, mic activation or hidden replay.
 * Run with the TS loader documented in the owning Nara contract. */
import {parseArgs} from 'node:util';
import {mkdir,open,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {platform,arch,release} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateAttachment,readNativeSession,requireNativeReady,nativeTurn,readDelivery,sameEncounter,localSpeechEndpoint,NativeTurnError} from '../src/nara/nativeDialogue.ts';
import {BrowserSpeechAudio} from '../src/nara/audio.ts';
const {values:v}=parseArgs({options:{help:{type:'boolean'},bridge:{type:'string'},source:{type:'string'},out:{type:'string'},'allow-provider':{type:'boolean'},'audio-file':{type:'string'},'play-output':{type:'boolean'},reconnect:{type:'boolean'},recover:{type:'string'},'check-native-mac':{type:'boolean'}}});
if(v.help){console.log(`Nara local acceptance (no fixtures)
--bridge http://127.0.0.1:PORT --source NATIVE_SOURCE_REF --out NEW_PRIVATE_DIRECTORY
Default: read-only native attachment/readiness/machine receipt, no provider call.
--allow-provider: send one bounded test turn through the existing admitted session.
--audio-file FILE.wav: explicitly selected speech input; STT -> native session -> TTS.
--play-output: on macOS, play only the returned WAV through afplay (never the microphone).
--recover DELIVERY_REF: read that original delivery only, without replay or automatic playback.
--reconnect: explicitly reconnect the same native session, never open/create.
--check-native-mac: read System Events' O-I window count; this is a host observation, not UI/audio acceptance.
Physical microphone, barge-in, re-entry and complete personal-path episodes are in docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md.
Personal content is saved only in the explicitly selected new directory with mode 0700/0600. Never upload it to public CI or corpus editions.`);process.exit(0);}
if(!v.bridge||!v.source||!v.out)throw Error('bridge, source and a new private output directory are required; see --help');
const bridge=localSpeechEndpoint(v.bridge).replace(/\/$/,'');
if(v['audio-file']&&!v['allow-provider'])throw Error('Audio input requires explicit --allow-provider consent');
if(v['play-output']&&(!v['audio-file']||!v['allow-provider']||v.recover))throw Error('Playback requires an explicitly permitted new audio turn; recovery never speaks automatically');
const output=resolve(v.out);await mkdir(output,{mode:0o700});
async function save(name,content){const file=await open(join(output,name),'wx',0o600);try{await file.writeFile(content);}finally{await file.close();}}
const receipt={schema:'oi.nara-local-acceptance/v1',started_at:new Date().toISOString(),machine:{platform:platform(),arch:arch(),release:release(),node:process.version},checks:[],standing:'in-progress',physical_microphone:'not-exercised',native_mac_interaction:'not-exercised',human_experience:'not-assessed'};
try{receipt.source_revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{receipt.source_revision='unavailable';}
async function op(request){const response=await fetch(bridge+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Kernel HTTP '+response.status);const body=await response.json();if(!body.ok||!body.outcome)throw Error(body.error??'Kernel returned no outcome');return body.outcome;}
const call=async(binding,request)=>{const result=await op({op:'encounter',project:binding.project,request});if(result.result!=='encounter_reading')throw Error('Native encounter reading unavailable');return result.data;};
try{
 const source=await op({op:'source_open',source_ref:v.source});if(source.result!=='source_opened')throw Error('No native source was returned');const buffer=source.buffer;
 if(buffer.dirty||buffer.conflict||buffer.content!==buffer.saved_content||!buffer.base_revision)throw Error('Attachment source must be saved and revision-bound');
 const a=validateAttachment(JSON.parse(buffer.saved_content)),view=await readNativeSession(call,a.dialogue);
 receipt.binding={nara:a.context.nara_ref,subject:a.context.subject_ref,expression:a.context.expression_ref,agent_session:a.dialogue.agent_session,body:a.constitution.body_ref,source_ref:v.source,source_revision:buffer.base_revision};
 receipt.provider_observation=view.connection;receipt.checks.push('saved-native-attachment','exact-existing-native-session-ready');
 const before=structuredClone(a);
 if(v.reconnect&&(view.connection?.state!=='Resident'||view.connection.error||!view.connection.resident)){await call(a.dialogue,{action:'reconnect',space:a.dialogue.space,agent_session:a.dialogue.agent_session,provider:a.dialogue.provider});const resumed=await requireNativeReady(call,a.dialogue);if(resumed.agent_session!==before.dialogue.agent_session||!sameEncounter(before,a))throw Error('Reconnect identity drift');receipt.checks.push('explicit-native-reconnect-same-session');}
 if(v['check-native-mac']){
  if(platform()!=='darwin')throw Error('Native Mac observation requested on another platform');
  const count=execFileSync('osascript',['-e','tell application "System Events" to count windows of process "O-I"'],{encoding:'utf8',timeout:10000}).trim();
  if(!/^\d+$/.test(count)||Number(count)<1)throw Error('No native O-I window was observed');receipt.native_mac_window_count=Number(count);receipt.checks.push('native-Mac-window-observed-only');
 }
 if(!v.recover)await requireNativeReady(call,a.dialogue);
 const audio=new BrowserSpeechAudio();let text;
 if(v['audio-file']){if(!a.speech)throw Error('No supported speech adapter selected');const bytes=await readFile(v['audio-file']);receipt.input_audio_sha256=createHash('sha256').update(bytes).digest('hex');text=await audio.transcribe(new Blob([bytes],{type:'audio/wav'}),a.speech,AbortSignal.timeout(120000));await save('input-transcript.txt',text);receipt.checks.push('actual-configured-STT-response');}
 let result;
 if(v.recover){result=await readDelivery({call,binding:a.dialogue,delivery_ref:v.recover,signal:AbortSignal.timeout(125000)});receipt.checks.push('same-delivery-readback-without-replay');}
 else if(v['allow-provider']){
  const nonce=randomUUID();receipt.delivery_ref='delivery/nara-local-acceptance-'+nonce;
  result=await nativeTurn({call,binding:a.dialogue,audience:a.constitution.agent_ref,text:JSON.stringify({request:text??`This is an explicitly authorised Nara acceptance turn. Acknowledge ${nonce} and describe only the supplied subject reference, without native changes.`,context:a.context}),source_refs:a.context.disclosed.map(d=>d.ref_id),delivery_ref:receipt.delivery_ref,signal:AbortSignal.timeout(125000)});
  receipt.checks.push('actual-addressed-native-response');
 }
 if(result){receipt.delivery_ref=result.delivery_ref;receipt.cursors={first:result.first_cursor,terminal:result.terminal_cursor};await save('native-response.txt',result.text);
  if(v['audio-file']&&!v.recover){const wav=await audio.synthesize(result.text,a.speech,AbortSignal.timeout(120000));await save('response.wav',Buffer.from(await wav.arrayBuffer()));receipt.checks.push('actual-configured-TTS-WAV');
   if(v['play-output']){if(platform()!=='darwin')throw Error('afplay acceptance is specific to macOS');execFileSync('afplay',[join(output,'response.wav')],{timeout:180000,stdio:'ignore'});receipt.checks.push('native-audio-player-completed');receipt.physical_audio='playback-process-completed; audibility remains human observation';}
  }
 }
 receipt.standing='executed-selected-episode';receipt.note='Owner-reported provider identity and actual native protocol result; not independent model-weight, physical microphone or human-experience certification';
 console.log('Selected native episode completed. Private evidence retained in the requested directory.');
}catch(error){receipt.standing='failed';receipt.failure=error instanceof Error?error.message:String(error);if(error instanceof NativeTurnError){receipt.delivery_ref=error.delivery_ref;receipt.original_failure=error.cause instanceof Error?error.cause.message:null;}console.error('Acceptance failed; original private failure and delivery identity retained. No automatic replay.');process.exitCode=1;}
finally{receipt.finished_at=new Date().toISOString();await save('receipt.json',JSON.stringify(receipt,null,2));}
