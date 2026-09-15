// Current native Factory readings plus persisted-workspace refusal checks.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdirSync,writeFileSync} from "node:fs";
import {build} from "esbuild";

const factory=process.env.WALK_FACTORY_BIN;
const statePath=process.env.WALK_FACTORY_STATE;
const runRef=process.env.WALK_FACTORY_RUN;
const bridge=process.env.WALK_KERNEL_BRIDGE??"http://127.0.0.1:4179";
assert.ok(factory&&statePath&&runRef,"Supply WALK_FACTORY_BIN, WALK_FACTORY_STATE and WALK_FACTORY_RUN for the current real Factory Run.");

const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
const module=async entry=>{
  const bundled=await build({entryPoints:[entry],bundle:true,format:"esm",platform:"node",write:false,logLevel:"silent"});
  return import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].text).toString("base64"));
};
const review=await module("src/contributions/factory/factory-review-snapshot.ts");
const persist=await module("src/surface/persist.ts");

const ownerBuild=JSON.parse(execFileSync(factory,["development","build",statePath,runRef,"--json"],{encoding:"utf8"}));
const unknownSubject="candidate:factory-review-current-owner-empty";
check(review.createFactoryMaterialReviewSnapshot(ownerBuild,{statePath,runRef,subjectRef:unknownSubject})===undefined,"Actual empty Build cannot become a retained Candidate review");

const listResponse=await fetch(bridge+"/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"factory_attempt_task_list_read",state_path:statePath,run_ref:runRef})});
check(listResponse.ok,"Kernel bridge serves the public Factory task-list read");
const listResult=await listResponse.json();
assert.equal(listResult.outcome?.result,"factory_attempt_task_list_reading","Factory serves the task-list contract");
check(Array.isArray(listResult.outcome.data.taskRefs)&&listResult.outcome.data.taskRefs.length===0,"Actual queued Run has no retained handoff task");

const materialExpected={kind:"factory-material",statePath,runRef,subjectRef:unknownSubject};
const handoffExpected={kind:"factory-handoff",statePath,runRef};
const corruptMaterial=review.exactFactoryReviewView({statePath,runRef,materialSnapshot:{damaged:true}},materialExpected,true);
check(Boolean(corruptMaterial?.snapshotUnavailable),"Corrupt material snapshot becomes explicit recovery");
const corruptHandoff=review.exactFactoryReviewView({statePath,runRef,handoffSnapshot:{damaged:true}},handoffExpected,true);
check(Boolean(corruptHandoff?.snapshotUnavailable),"Corrupt handoff snapshot becomes explicit recovery");
const oversizedNotice=review.exactFactoryReviewView({statePath,runRef,snapshotUnavailable:"x".repeat(1025)},materialExpected,true);
check(Boolean(oversizedNotice?.snapshotUnavailable),"Oversized recovery notice becomes a bounded recovery notice");
const wrongKind=review.exactFactoryReviewView({statePath,runRef,handoffSnapshot:{damaged:true}},materialExpected,true);
check(Boolean(wrongKind?.snapshotUnavailable),"Wrong snapshot kind cannot hydrate a material Surface");
const malformedRevision=review.exactFactoryReviewView({statePath,runRef,expectedRevision:"wrong"},handoffExpected,true);
check(Boolean(malformedRevision?.snapshotUnavailable),"Malformed expected revision blocks automatic reread");
const mismatchedRevision=review.exactFactoryReviewView({statePath,runRef,expectedRevision:1,materialSnapshot:{statePath,runRef,subjectRef:unknownSubject,revision:2,payload:ownerBuild}},materialExpected,true);
check(Boolean(mismatchedRevision?.snapshotUnavailable),"Wrong retained revision blocks automatic reread");

const decoded=persist.decodeLayout({
  agencyDepth:"strip",
  surfaces:{
    draft:{id:"draft",kind:"draft",title:"Draft"},
    material:{id:"material",kind:"factory-material",title:"Review",project:"O-I",ref:unknownSubject,view:{factory:{statePath,runRef,materialSnapshot:{damaged:true}}}},
  },
  root:{type:"group",id:"root",tabs:["draft","material"],pinned:[],active:"material"},
  focusedGroupId:"root",
});
check(Boolean(decoded.surfaces.draft),"Invalid review snapshot preserves an unrelated draft binding");
check(decoded.surfaces.material?.view?.factory?.snapshotUnavailable?.includes("Refresh explicitly")===true,"Invalid review persists an explicit recovery notice");

const artifactDir="walk/artifacts/factory-review-continuation-20260915";
mkdirSync(artifactDir,{recursive:true});
writeFileSync(artifactDir+"/factory-review-read.json",JSON.stringify({
  standing:"C: current native Factory Build and task-list reads plus corrupt local presentation derivatives. No populated Candidate, Evidence, Handoff, execution or acceptance is claimed.",
  checks,
  source:{factory,statePath,runRef,candidates:ownerBuild.view?.candidates?.length,evidence:ownerBuild.view?.evidence?.length,taskRefs:listResult.outcome.data.taskRefs},
  limitation:"The current native Build and task list are empty, so positive populated-material retention remains unproved.",
},null,2)+"\n");
