// Current native Factory readings plus persisted-workspace refusal checks.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {copyFileSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
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
const reuse=await module("src/surface/binding-reuse.ts");

const ownerBuild=JSON.parse(execFileSync(factory,["development","build",statePath,runRef,"--json"],{encoding:"utf8"}));
const unknownSubject="candidate:factory-review-current-owner-empty";
const stateCopyDirectory=mkdtempSync(join(tmpdir(),"oi-factory-binding-reuse-"));
const copiedStatePath=join(stateCopyDirectory,"header-continuity.state.json");
try {
  copyFileSync(statePath,copiedStatePath);
  const copiedBuild=JSON.parse(execFileSync(factory,["development","build",copiedStatePath,runRef,"--json"],{encoding:"utf8"}));
  check(ownerBuild.contract==="factory.build-view/v1"&&copiedBuild.contract==="factory.build-view/v1"&&ownerBuild.view?.run?.runRef===runRef&&copiedBuild.view?.run?.runRef===runRef,"Both disk-backed native state paths return the selected Factory Run");
  const handoff=(source,revision)=>({id:`handoff-${source===statePath?"source":"copy"}-${revision??"unqualified"}`,kind:"factory-handoff",title:"Run handoff",project:"O-I",ref:runRef,view:{factory:{statePath:source,runRef,...(revision===undefined?{}:{expectedRevision:revision})}}});
  const material=(revision)=>({id:`material-${revision}`,kind:"factory-material",title:"Review",project:"O-I",ref:unknownSubject,view:{factory:{statePath,runRef,expectedRevision:revision}}});
  check(reuse.matchesSurfaceRequest(handoff(statePath,7),handoff(copiedStatePath,undefined))===false,"Distinct valid Factory state paths do not reuse a handoff Surface");
  check(reuse.matchesSurfaceRequest(handoff(statePath,7),handoff(statePath,undefined))===true,"An unqualified handoff reopen preserves the held review for its exact state and Run");
  check(reuse.matchesSurfaceRequest(handoff(statePath,7),handoff(statePath,8))===false,"An explicit different handoff revision does not reuse the held review");
  check(reuse.matchesSurfaceRequest(material(7),material(undefined))===true,"An unqualified material reopen preserves the held review for its exact state and Run");
  check(reuse.matchesSurfaceRequest(material(7),material(8))===false,"An explicit different material revision does not reuse the held review");
} finally {
  rmSync(stateCopyDirectory,{recursive:true,force:true});
}
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

const artifactDir="walk/artifacts/factory-live-continuation-20260915";
mkdirSync(artifactDir,{recursive:true});
writeFileSync(artifactDir+"/factory-binding-reuse-read.json",JSON.stringify({
  standing:"C: current native Factory Build and task-list reads plus corrupt local presentation derivatives. No populated Candidate, Evidence, Handoff, execution or acceptance is claimed.",
  checks,
  source:{factory,statePath,runRef,candidates:ownerBuild.view?.candidates?.length,evidence:ownerBuild.view?.evidence?.length,taskRefs:listResult.outcome.data.taskRefs,bindingReuse:"Both original and disk-backed copied native states were read; task scratch removed after identity checks."},
  limitation:"The current native Build and task list are empty, so positive populated-material retention remains unproved.",
},null,2)+"\n");
