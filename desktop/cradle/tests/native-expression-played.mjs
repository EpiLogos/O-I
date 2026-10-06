/** A played strike through the real O:I kernel bridge, measured in the PCM.
 * QL compose → kernel bridge → ql-field-host + C++ worker → `strike` exchange →
 * advance blocks. The claim is the sound itself: a struck voice's own frequency
 * rises above the same body's unstruck output (control), measured by Goertzel
 * on the native PCM. No browser, no mock owner; not speaker evidence.
 * Env: OI_QL_BIN OI_QL_FIELD_HOST_BIN OI_QL_FIELD_WORKER_BIN (absolute), argv[2]=bridge. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const need=n=>{const v=process.env[n];assert.ok(v&&v.startsWith('/'),`${n} must be an absolute path`);return v;};
const env={...process.env,OI_BIN:'/usr/bin/false',OI_CENTRAL_ROOT:'/tmp',OI_CENTRAL_PROJECT_QUERY:'',OI_QL_BIN:need('OI_QL_BIN'),OI_QL_SKY_BIN:'/usr/bin/false',OI_QL_FIELD_HOST_BIN:need('OI_QL_FIELD_HOST_BIN'),OI_QL_FIELD_WORKER_BIN:need('OI_QL_FIELD_WORKER_BIN')};
const bridge=spawn(process.argv[2],['127.0.0.1:0'],{env,stdio:['ignore','pipe','pipe']});
let log='',err='';bridge.stdout.on('data',x=>log+=x);bridge.stderr.on('data',x=>err+=x);
const endpoint=await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('bridge start timeout '+err)),15000);bridge.stdout.on('data',()=>{const m=log.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);res(m[0]);}});});
const op=async body=>{const r=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return r.json();};
const goertzel=(x,hz,rate)=>{const w=2*Math.PI*hz/rate,c=2*Math.cos(w);let a=0,b=0;for(const v of x){const n=v+c*a-b;b=a;a=n;}return Math.sqrt(a*a+b*b-c*a*b)/x.length;};
const FRAMES=4096,BLOCKS=6;
const run=async(label,strike)=>{
 const c=await op({op:'native_expression',request:{operation:'compose',request:{texture:[64,64],units_per_metre:120,sky:'none'}}});
 assert.ok(c.ok,`compose: ${c.error}`);
 const data=c.outcome.data,f=data.receipt.field;let seq=0n,state={generation:f.generation,samples_elapsed:f.samples_elapsed};
 const ex=async command=>{seq+=1n;const request={schema:'ql.field-host-request/v1',instance_ref:data.receipt.instance_ref,event_ref:f.event_ref,subject_ref:f.subject_ref,request_id:seq.toString(),expected_generation:state.generation,expected_samples_elapsed:state.samples_elapsed,command};
  const r=await op({op:'native_expression',request:{operation:'exchange',lease:data.lease,request}});assert.ok(r.ok,`${command.operation}: ${r.error}`);const rep=r.outcome.data;assert.equal(rep.status,'ok',`${command.operation}: ${rep.error}`);
  state={generation:rep.field.generation,samples_elapsed:rep.field.samples_elapsed};return rep;};
 const ins=await ex({operation:'inspect'});
 const voices=ins.influence.voices;
 const target=voices[0];
 // the scene's opening event strikes on admission; let that ring out of the measurement by reading a settled baseline
 if(strike)await ex({operation:'strike',strikes:[{mode_ref:target.mode_ref,amplitude:[0.5,0]}]});
 const pcm=[];let shape=null;
 for(let i=0;i<BLOCKS;i++){const rep=await ex({operation:'advance',frames:FRAMES,muted:false});shape??={frames:rep.field.audio.length,sample_rate:rep.field.sample_rate};
  assert.equal(rep.field.audio.length,FRAMES,'one mono PCM value per frame');for(const v of rep.field.audio)pcm.push(v);}
 await op({op:'native_expression',request:{operation:'close',lease:data.lease}});
 const rate=f.sample_rate;
 const energy=hz=>goertzel(Float32Array.from(pcm),hz,rate);
 const rms=Math.sqrt(pcm.reduce((s,v)=>s+v*v,0)/Math.max(1,pcm.length));
 return {label,shape,samples:pcm.length,rate,rms,target:{mode_ref:target.mode_ref,hz:target.frequency_hz,level:energy(target.frequency_hz)},others:voices.slice(1).map(v=>({hz:v.frequency_hz,level:energy(v.frequency_hz)})),pcm};
};
try{
 const control=await run('control (no strike)',false),struck=await run('played strike on voice 0',true);
 for(const r of [control,struck])console.log(r.label,JSON.stringify({shape:r.shape,samples:r.samples,rms:r.rms,target_hz:r.target.hz,target_level:r.target.level}));
 writeFileSync(process.env.PLAYED_PCM_OUT??'/dev/null',JSON.stringify({rate:struck.rate,target:struck.target,pcm:struck.pcm.slice(0,FRAMES*BLOCKS)}));
 const gain=struck.target.level/Math.max(control.target.level,1e-12);
 console.log('target-voice level struck/control =',gain.toFixed(2));
 assert.ok(struck.rms>0,'the struck run is silent');
 assert.ok(gain>3,`the strike did not raise the struck voice's own frequency (gain ${gain})`);
 console.log('PASS: the played strike is audible in the native PCM at the struck voice\'s own frequency');
}catch(e){console.log('FAIL',e.message,'\nbridge stderr:',err.slice(-600));process.exitCode=1;}
finally{bridge.kill();}
