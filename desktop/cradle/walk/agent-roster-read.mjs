import {execFileSync} from "node:child_process";

const ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl";
const project=process.env.OI_AGENT_ROSTER_PROJECT??"O-I";
const run=(action,input)=>{
  const raw=execFileSync(ctrl,["action","run",action,JSON.stringify(input),"--json"],{encoding:"utf8",env:process.env});
  const result=JSON.parse(raw);
  if(!result.ok)throw new Error(action+" refused: "+JSON.stringify(result.error??result));
  return result.data;
};
const profile=(row,scope)=>{
  if(!row||typeof row!=="object"||!row.profile||typeof row.profile!=="object"||typeof row.source_path!=="string")throw new Error(scope+" AgentProfile envelope invalid");
  const value=row.profile;
  if(value.schema!=="central.agent-profile/v1"||typeof value.ref!=="string"||typeof value.revision!=="string"||typeof value.agent_ref!=="string"||typeof value.world_ref!=="string")throw new Error(scope+" AgentProfile record invalid");
  return {ref:value.ref,revision:value.revision,source_path:row.source_path};
};
const set=(row,scope)=>{
  if(!row||typeof row!=="object"||typeof row.ref!=="string"||typeof row.revision!=="string"||typeof row.source_path!=="string"||!row.record||typeof row.record!=="object")throw new Error(scope+" AgentSet envelope invalid");
  const value=row.record;
  if(value.schema!=="central.agent-set/v1"||value.ref!==row.ref||value.revision!==row.revision||!Array.isArray(value.members))throw new Error(scope+" AgentSet record invalid");
  for(const member of value.members){
    if(!member||typeof member!=="object"||(member.kind==="agent"&&typeof member.agent_ref!=="string")||(member.kind==="agent-set"&&typeof member.agent_set_ref!=="string")||!["agent","agent-set"].includes(member.kind))throw new Error(scope+" AgentSet member invalid");
  }
  return {ref:row.ref,revision:row.revision,source_path:row.source_path};
};
const scopes=[
  ["personal","root",{}],
  ["project","project",{project}],
];
const catalogue=JSON.parse(execFileSync(ctrl,["action","list","--json"],{encoding:"utf8",env:process.env}));
if(!catalogue.ok||!Array.isArray(catalogue.data?.actions))throw new Error("Central Action catalogue read invalid");
const expressive=catalogue.data.actions.find((entry)=>entry?.id==="agent-profile.express");
const action_catalog={express_action:expressive?{available:expressive.availability?.available===true}:null};
const result={project,action_catalog,scopes:[]};
for(const [name,scope,input] of scopes){
  const profiles=run("agent-profile.list",{scope,...input}).profiles;
  const sets=run("central.agent-set.list",{scope,...input}).records;
  if(!Array.isArray(profiles)||!Array.isArray(sets))throw new Error(name+" list wrapper invalid");
  result.scopes.push({scope:name,profiles:profiles.map(row=>profile(row,name)),sets:sets.map(row=>set(row,name))});
}
const refs=new Set();
for(const scope of result.scopes)for(const row of scope.profiles){if(refs.has(row.ref))throw new Error("duplicate AgentProfile ref across scopes: "+row.ref);refs.add(row.ref);}
console.log(JSON.stringify(result,null,2));
