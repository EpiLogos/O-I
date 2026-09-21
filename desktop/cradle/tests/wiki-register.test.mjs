import test from 'node:test';
import assert from 'node:assert/strict';
import {readRegister} from '../src/knowledge/construction.ts';
const transport={kind:'bridge',url:'http://controlled.invalid'};
const location={schema:'central.path-ref/v1',ref:'central:path:wiki',root:'/temporary-ground',path:'Work/Notes/ProjectCentral/agents/wiki/wiki.json'};
async function exercise(project,options={}){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(_url,init)=>{
  const op=JSON.parse(init.body);calls.push(op);let outcome;
  if(op.op==='world_browse')outcome={result:'world_read',snapshot:{navigator:{root:{root:'/temporary-ground',work:{projects:options.missing?[]:[{name:'Notes',path:'Work/Notes'}]}}}}};
  else if(op.op==='project_browse')outcome={result:'world_read',snapshot:{navigator:options.redirect?{project:{project:{name:'Other',path:'Work/Other'}}}:{project:{project:{name:'Notes',path:'Work/Notes'}}}}};
  else if(op.op==='invoke_action')outcome={result:'action_dispatched',dispatch:{state:'invoked',data:{schema:'central.wiki-reading/v1',source:{path:project?'ProjectCentral/agents/wiki/wiki.json':'Control/agents/wiki/wiki.json',ref:'source:register',revision:'r1'}}}};
  else if(op.op==='files_list')outcome={result:'directory_read',directory:{entries:[{name:'wiki.json',kind:'file',location}]}};
  else if(op.op==='file_read')outcome={result:'file_read',reading:{location,revision:options.changed?'r2':'r1',content:JSON.stringify({objects:[{object:'space',ref:'wiki:space',title:'Ordinary Wiki'}]})}};
  else throw new Error(`Unexpected ${op.op}`);
  return {json:async()=>({ok:true,outcome})};
 };
 try{return {reading:await readRegister(transport,project),calls};}
 catch(error){return {error,calls};}
 finally{globalThis.fetch=original;}
}
test('a direct Wiki entrance establishes Central root before Project navigation and register reads',async()=>{
 const {reading,calls,error}=await exercise('Notes');assert.equal(error,undefined);
 assert.deepEqual(calls.map(c=>c.op),['world_browse','project_browse','invoke_action','files_list','file_read']);
 assert.equal(calls[2].invocation.action,'projectcentral.wiki.read');
 assert.equal(calls[3].path,'Work/Notes/ProjectCentral/agents/wiki');
 assert.equal(reading.spaces[0].ref,'wiki:space');
 assert.ok(calls.every(c=>!['world_open','project_open','focus'].includes(c.op)),'browse does not change authored focus');
});
test('an undisclosed Project is refused before project-scoped action or filesystem navigation',async()=>{
 const {calls,error}=await exercise('Outside',{missing:true});
 assert.match(error.message,/outside the disclosed Central world/);
 assert.deepEqual(calls.map(c=>c.op),['world_browse']);
});
test('a redirected Project and a register revision race both refuse rather than crossing source identity',async()=>{
 const redirected=await exercise('Notes',{redirect:true});assert.match(redirected.error.message,/native directory disclosure/);assert.equal(redirected.calls.length,2);
 const changed=await exercise('Notes',{changed:true});assert.match(changed.error.message,/register changed/);
});
test('Central remains a usable root meta-project without inventing a child Project',async()=>{
 const {calls,error}=await exercise(undefined);assert.equal(error,undefined);
 assert.equal(calls[1].invocation.action,'central.wiki.read');assert.deepEqual(calls[1].invocation.input,{project:null});
 assert.equal(calls[2].path,'Control/agents/wiki');assert.ok(!calls.some(c=>c.op==='project_browse'));
});
