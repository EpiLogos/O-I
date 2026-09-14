import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import ts from "typescript";

const factory=process.env.WALK_FACTORY_BIN;
const statePath=process.env.WALK_FACTORY_STATE;
const runRef=process.env.WALK_FACTORY_RUN;
assert.ok(factory,"Supply WALK_FACTORY_BIN with the native Factory binary under test.");
assert.ok(statePath&&runRef,"Supply WALK_FACTORY_STATE and WALK_FACTORY_RUN for an actual Factory Build.");
const stdout=execFileSync(factory,["development","build",statePath,runRef,"--json"],{encoding:"utf8"});
const source=readFileSync(new URL("../src/contributions/factory/factory-material-reading.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText;
const model=await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const ownerReading=JSON.parse(stdout);
const decoded=model.readFactoryMaterialBuild(ownerReading,runRef);
assert.ok(decoded.reading,"The native Factory Build must decode before selection.");
assert.equal(decoded.reading.run.runRef,runRef,"The decoder preserves the requested canonical Run.");
assert.ok(Number.isSafeInteger(decoded.reading.revision),"The decoder accepts only a safe integral Build revision.");
const missingSubject="candidate:walk-missing-subject";
const missing=model.selectFactoryMaterial(ownerReading,runRef,missingSubject);
assert.equal(missing.kind,"refusal","An unretained Candidate/Evidence subject must be refused.");
assert.match(missing.message,new RegExp(`does not retain Candidate or Evidence ${missingSubject}`),"The refusal names the requested opaque subject exactly.");
const duplicate=structuredClone(ownerReading);
duplicate.view.candidates=[
  {candidateRef:"candidate:walk-duplicate",revision:1,label:"first",status:"ready",producingExecutionRefs:[],claimRefs:[],evidenceRefs:[]},
  {candidateRef:"candidate:walk-duplicate",revision:2,label:"second",status:"ready",producingExecutionRefs:[],claimRefs:[],evidenceRefs:[]},
];
const duplicateReading=model.readFactoryMaterialBuild(duplicate,runRef);
assert.equal(duplicateReading.kind,"refusal","Duplicate canonical Candidate identities must not be silently accepted.");
assert.equal(duplicateReading.message,"Factory Build contains duplicate canonical material references.");
writeFileSync("walk/artifacts/factory-material-owner-read.json",JSON.stringify({
  standing:"C: frozen native Factory Build read and production material decoder; no populated Candidate/Evidence exists in this owner reading.",
  source:{factory,statePath,runRef,buildRevision:decoded.reading.revision,factoryStateRevision:decoded.reading.factoryStateRevision},
  assertions:["exact Run decoded","unknown material subject refused","duplicate canonical material identity refused"],
  ownerMaterial:{candidates:decoded.reading.candidates.length,evidence:decoded.reading.evidence.length,positivePopulatedMaterial:"unproved"},
},null,2)+"\n");
console.log("PASS factory material decoder",JSON.stringify({revision:decoded.reading.revision,runRef,candidates:decoded.reading.candidates.length,evidence:decoded.reading.evidence.length}));
