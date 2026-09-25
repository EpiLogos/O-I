/** Test-only human-operated page using the production DictationSession.
 * No fake media flags, permission auto-grants, remote speech, or auto-send. */
import {DictationSession} from '../src/dictation/client';
import {writeSttUrl} from '../src/dictation/store';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/rest.css';
const params=new URLSearchParams(location.search),phrase=params.get('phrase')!;
const configure=()=>writeSttUrl(params.get('endpoint')!);
const report:{classification:string;phrase:string;mic?:unknown;audio?:unknown;error?:string;done:boolean;passed:boolean}={classification:'human-operated real browser microphone/STT and audible-output check, not native-WKWebView microphone proof',phrase,done:false,passed:false};
(window as unknown as {localAudio:typeof report}).localAudio=report;
const main=document.createElement('main');main.style.cssText='max-width:52rem;margin:2rem auto;padding:1.5rem;line-height:1.6';document.body.append(main);
const title=document.createElement('h1');title.textContent='Local microphone and audio acceptance';main.append(title);
const intro=document.createElement('p');intro.textContent='This uses your real microphone and the existing local transcription client. Permission stays your choice. Nothing is sent to an Agent. Speak the displayed phrase, then stop. The server must already be running.';main.append(intro);
const words=document.createElement('p');words.textContent='Say: '+phrase;main.append(words);
const status=document.createElement('p');status.setAttribute('role','status');main.append(status);
function button(label:string,handler:()=>Promise<void>|void){const b=document.createElement('button');b.textContent=label;b.style.margin='0.5rem';b.onclick=()=>void Promise.resolve(handler()).catch(error=>{report.error=String(error);status.textContent=report.error;});main.append(b);return b;}
let session:DictationSession|null=null;let micPassed=false,heard=false,started=0;
const start=button('Start microphone',async()=>{start.disabled=true;session=new DictationSession();try{await configure();await session.begin();started=performance.now();stop.disabled=false;status.textContent='Recording. Speak the phrase and then stop.';}catch(error){session=null;start.disabled=false;throw error;}});
const stop=button('Stop and transcribe locally',async()=>{
 stop.disabled=true;const active=session;session=null;if(!active)throw Error('No recording');
 status.textContent='Transcribing with your local server…';const outcome=await active.end();
 const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
 micPassed=outcome.kind==='transcript'&&normalize(outcome.text).includes(normalize(phrase));
 report.mic={outcome:outcome.kind,phraseMatched:micPassed,durationMs:Math.round(performance.now()-started),inputDevices:(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput').length};
 // Do not write a personal transcript into the receipt. The human may read it here.
 status.textContent=outcome.kind==='transcript'?`Heard: ${outcome.text}. Phrase match: ${micPassed}.`:JSON.stringify(outcome);
 start.disabled=false;finish.disabled=!(micPassed&&heard);
});stop.disabled=true;
const play=button('Play a quiet test tone',async()=>{
 const context=new AudioContext();try{await context.resume();const tone=context.createOscillator(),gain=context.createGain();gain.gain.value=0.035;tone.frequency.value=440;tone.connect(gain);gain.connect(context.destination);tone.start();await new Promise<void>(resolve=>{tone.onended=()=>resolve();tone.stop(context.currentTime+0.4);});report.audio={contextState:context.state,sampleRate:context.sampleRate,humanHeard:false};confirm.disabled=false;}finally{await context.close();}
});
const confirm=button('I heard the tone',()=>{heard=true;report.audio={...report.audio as object,humanHeard:true};finish.disabled=!micPassed;});confirm.disabled=true;
const finish=button('Finish and record acceptance',()=>{if(!micPassed||!heard)throw Error('Both the spoken phrase and audible output need observation');report.passed=true;report.done=true;});finish.disabled=true;
button('Stop the check without acceptance',()=>{report.error='Stopped by the person; no passing audio claim';report.done=true;});
