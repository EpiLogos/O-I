import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {readFileSync} from "node:fs";
import {adapterRoutes} from "./instrument-host.mjs";

const ql=process.env.K9_QL_REPO;
const host=process.env.K9_FOCUSED_HOST??`${ql}/target/debug/ql-focused-host`;
const worker=process.env.K9_FIELD_WORKER??`${ql}/target/k8-cpp/bin/ql-field-worker`;
const config=process.env.K9_FOCUSED_CONFIG??`${ql}/target/k8-personal/focused-host-config.json`;
const reception=JSON.parse(readFileSync(process.env.K9_FOCUSED_RECEPTION??`${ql}/target/k8-personal/focused-host-reception.json`,"utf8"));

function nativePipe(){
  const child=spawn(host,[worker,config],{stdio:["pipe","pipe","pipe"]});
  const lines=createInterface({input:child.stdout}),waiting=[];let stderr="";
  child.stderr.on("data",chunk=>{stderr+=chunk;});
  lines.on("line",line=>waiting.shift()?.resolve(JSON.parse(line)));
  const next=()=>new Promise((resolve,reject)=>waiting.push({resolve,reject}));
  child.on("exit",code=>waiting.splice(0).forEach(waiter=>waiter.reject(new Error(`ql-focused-host exited ${code}: ${stderr}`))));
  return {child,next,request:async request=>{child.stdin.write(`${JSON.stringify(request)}\n`);return next();}};
}

export default async function run({page,baseUrl,check,shot,channel}){
  adapterRoutes(page);const pipe=nativePipe();
  try{
    const ready=await pipe.next();check(ready.status==="ready"&&ready.snapshot?.nara_expression==null,"Real focused host opens before explicit Personal reception");
    await page.exposeFunction("__qlFocusedRequest",request=>pipe.request(request));
    await page.goto(baseUrl);await channel("info");await page.locator(".oi-point-cloud-overlay").waitFor({timeout:20000});
    const setup=await page.evaluate(async({ready,reception})=>{
      const {FocusedInstrumentSession}=await import("/k9-host/focused-instrument-session.mjs");
      const audioContext=new AudioContext({sampleRate:48000});await audioContext.suspend();
      const session=new FocusedInstrumentSession({ref:"ql:host:native",title:"Native Nara owner",initialReceipt:ready,transport:{request:request=>globalThis.__qlFocusedRequest(request)},correspondence:{sourceRef:"acceptance:continuous:dated-world",revision:"b38461a",slotsA:Array.from({length:65536},(_,i)=>i%16),slotsB:Array.from({length:65536},(_,i)=>(i+1)%16)},audioContext,autostart:false});
      const received=await session.command({kind:"receive-personal",input:reception});
      globalThis.__k9ExternalSources={"ql:host:native":session};globalThis.__k9Session=session;
      return {standing:received.standing,current:received.snapshot?.nara_expression?.current,centres:received.snapshot?.nara_expression?.centres?.length};
    },{ready,reception});
    check(setup.standing==="applied"&&setup.current&&setup.centres===7,"Explicit controlled reception is computed by the real Personal owner",setup);
    check((await channel("instrument.registerExisting",["ql:host:native"])).ok,"Real native browser adapter registers");
    await channel("instrument.requestOpen",["ql:host:native"]);const region=page.locator('[data-epi-nara-region="instrument"]');await region.waitFor({timeout:15000});
    await page.waitForFunction(()=>globalThis.__k9Session.reading.attached===true,null,{timeout:15000});
    const before=await page.evaluate(()=>globalThis.__k9Session.reading.retained);
    for(const focus of ["M1","M2","M3","M4"])await region.getByRole("button",{name:focus,exact:true}).click();
    await page.getByText("source-centre-0").waitFor();
    const after=await page.evaluate(()=>globalThis.__k9Session.reading.retained);
    check(before.seeds===after.seeds,"Real native M1→M4 focus does not reseed the retained field",{before:before.seeds,after:after.seeds});
    const refused=await page.evaluate(async input=>{const bad=structuredClone(input);bad.event_ref="foreign:event";return globalThis.__k9Session.command({kind:"receive-personal",input:bad});},reception);
    check(refused.standing==="refused"&&refused.snapshot.nara_expression.current,"Native Personal owner refuses foreign reception and retains current reading",refused.error);
    await shot("instrument-native-nara");
    await page.getByRole("button",{name:"Close Native Nara owner",exact:true}).click();await region.waitFor({state:"detached"});
    await channel("instrument.requestOpen",["ql:host:native"]);await region.waitFor();await page.waitForFunction(()=>globalThis.__k9Session.reading.attached===true);
    const reentered=await page.evaluate(()=>globalThis.__k9Session.reading.retained);
    check(after.seeds===reentered.seeds,"Real native Nara re-entry preserves the field seed generation",{after:after.seeds,reentered:reentered.seeds});
  }finally{pipe.child.kill();}
}
