/**
 * Provision the SF6 joined-field Agent electricity: an isolated AIKit home
 * with a SessionSpace, an attached agent session, the Codex bridge provider
 * and the Agency binding admitted through the owner's real Actuation
 * authority; then run the resident encounter owner. Idempotent per home.
 * The controller JSON it prints is the kernel's OI_SHARED_AGENT_CONTROLLER.
 */
import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

const HOME=resolve(process.env.OI_SF6_AGENT_HOME??join(process.cwd(),".aikit/sf6-agency/home"));
const AGENCY_SRC=resolve(process.env.OI_SF6_AGENCY_SRC??join(HOME,"../agency-request.json"));
const POLICY_SRC=resolve(process.env.OI_SF6_POLICY_SRC??join(HOME,"../model-policy.json"));
const ADAPTER=resolve(process.env.OI_SF6_ADAPTER??join(HOME,"../../providers/sf6-codex-resident.mjs"));
const SOCKET=join(HOME,"ipc/owner.sock");
const SPACE="session-space/sf6",SESSION="agent-session/sf6-world-b",SENDER="human:sf6-owner";
const blake3=p=>execFileSync(process.env.OI_SF6_B3SUM??"b3sum-file",[p],{encoding:"utf8"}).trim();
const run=(cmd,args,env={})=>execFileSync(cmd,args,{encoding:"utf8",env:{...process.env,...env},input:undefined});
const runCapture=(cmd,args,env={})=>{try{return run(cmd,args,env);}catch(e){return e.stdout?.toString()??String(e);}};

export function provision({serve=true}={}){
 mkdirSync(join(HOME,"ipc"),{recursive:true,mode:0o700});
 mkdirSync(HOME,{recursive:true});
 // Session space + agent session (idempotent: create fails softly when exists).
 const p1=runCapture("aikit-session-space",["create",SPACE],{AIKIT_HOME:HOME});
 if(p1.includes('"space"')){writeFileSync(join(HOME,"p-create.json"),p1);runCapture("aikit-session-space",["apply","--preview-json",`@${join(HOME,"p-create.json")}`],{AIKIT_HOME:HOME});}
 const p2=runCapture("aikit-session-space",["stage","--space",SPACE,"--intent-json",JSON.stringify({operation:"attach-agent-session",attachment:{agent_session:SESSION,purpose:"SF6 joined two-world Agent presence",provenance:["run-scoped acceptance"]}})],{AIKIT_HOME:HOME});
 if(p2.includes('"space"')){writeFileSync(join(HOME,"p-attach.json"),p2);runCapture("aikit-session-space",["apply","--preview-json",`@${join(HOME,"p-attach.json")}`],{AIKIT_HOME:HOME});}
 // Provider: the Codex bridge adapter (real model, read-only sandbox).
 runCapture("aikit-session-space",["encounter-configure","--provider-json",JSON.stringify({protocol:"pi-rpc",id:"codex-sol-joined",label:"Codex Sol low for the joined field",argv:["/opt/homebrew/bin/node",ADAPTER]})],{AIKIT_HOME:HOME});
 // Agency binding admitted through the owner's real Actuation authority.
 const binding={revision:"rev/sf6-1",active:true,agent_ref:"agent:sf6-world-b",agency_ref:"agency:sf6-world-b",world_ref:"project:o-i",world_binding_ref:"binding:sf6-world-b",agency_source:{source_ref:"source/sf6-joined-agency",revision:"source/2",path:AGENCY_SRC,content_digest:blake3(AGENCY_SRC)},actuation_bin:resolve(process.env.OI_SF6_ACTUATION_BIN??"/Users/admin/Central/Work/Actuation/target/release/actuation"),allowed_senders:[SENDER],allowed_packet_sources:[],context:null};
 runCapture("aikit-session-space",["encounter-agency-configure","--agent-session",SESSION,"--binding-json",JSON.stringify(binding)],{AIKIT_HOME:HOME});
 // Resident owner.
 let stop=()=>{};
 if(serve&&existsSync(HOME)){
  const child=spawn("aikit-session-space",["encounter-serve","--socket",SOCKET],{cwd:"/tmp",detached:true,stdio:["ignore","ignore","ignore"],env:{...process.env,AIKIT_HOME:HOME}});
  stop=()=>{try{process.kill(-child.pid,"SIGTERM");}catch{child.kill("SIGTERM");}};
  const deadline=Date.now()+30000;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  return (async()=>{while(Date.now()<deadline){try{if(existsSync(SOCKET))break;}catch{}await wait(200);}return {controller:JSON.stringify({socket:SOCKET,sender:SENDER,candidate_session:SESSION,cwd:HOME}),stop};})();
 }
 return Promise.resolve({controller:JSON.stringify({socket:SOCKET,sender:SENDER,candidate_session:SESSION,cwd:HOME}),stop});
}
