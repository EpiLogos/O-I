// Native Factory CLI -> production Run projection. This is not desktop,
// provider, installation or self-inhabitation evidence. The receiver browser
// and native socket packets test their own receiving surfaces separately.
// Usage: node walk/factory-run-expression.mjs <factory-bin> <state-path> <run-ref> [new-document-output]
import {readFile,writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import ts from "typescript";
const [factoryBin,statePath,runRef,output]=process.argv.slice(2);
if(!factoryBin||!statePath||!runRef)throw new Error("usage: node walk/factory-run-expression.mjs <factory-bin> <state-path> <run-ref> [new-document-output]");
const checks=[];
const check=(name,ok,detail="")=>{checks.push({name,ok,detail});if(!ok)throw new Error(`check failed: ${name} ${detail}`);};
const cli=args=>{
  const result=spawnSync(factoryBin,args,{encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024});
  if(result.error)throw result.error;
  return result;
};
const read=args=>{const result=cli(args);if(result.status!==0)throw new Error(result.stderr||result.stdout||`Factory read failed: ${result.status}`);return JSON.parse(result.stdout);};
const run=read(["development","run",statePath,runRef,"--json"]);
const units=read(["development","workflow-units",statePath,runRef,"--json"]);
const attemptResult=cli(["attempt","read",statePath,runRef,"--json"]);
let attempt;let attemptsSkipped=null;
if(attemptResult.status===0)attempt=JSON.parse(attemptResult.stdout);
else {
  const refusal=String(attemptResult.stderr||attemptResult.stdout||"");
  if(!refusal.includes("no native attempt field"))throw new Error(refusal||"Factory attempt read failed");
  attemptsSkipped=refusal;
}
const after=read(["development","run",statePath,runRef,"--json"]);
check("stable native reading occasion",JSON.stringify(run)===JSON.stringify(after));
check("requested native Run",run.runRef===runRef);
check("run reading contract",run.contract==="factory.run-reading/v1");
check("attempt reading contract",!attempt||attempt.contract==="factory.attempt-reading/v1");
check("unit list contract",units.contract==="factory.workflow-unit-list-reading/v1");
const source=await readFile(new URL("../src/contributions/factory/run-expression.ts",import.meta.url),"utf8");
// Test-only direct-CLI composition probe; the actual production transport is
// exercised without substitution by factory-run-receiving.test.mjs.
const isolated=source.replace(/import \{ *developmentRead *, *attemptRead *\} *from *"\.\/development";/,"const developmentRead=undefined,attemptRead=undefined;");
const js=ts.transpileModule(isolated,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const adapter=await import("data:text/javascript,"+encodeURIComponent(js));
const expressionRef="expression:walk-factory-run-expression";
const document=adapter.composeRunExpression({run,attempt,units,statePath},expressionRef);
const entities=Object.values(document.entities),relations=Object.values(document.relations);
const subjects=new Set(entities.map(e=>e.subject?.subject_ref));
const root=document.entities[`${expressionRef}:entity:run`]?.subject;
check("expression schema",document.schema==="oi.expression/v1");
check("same Run Being and native owner",root?.subject_ref===run.runRef&&root?.native_owner==="software-factory"&&root?.presentation_role==="being");
check("bounded Expression-local entity refs",Object.keys(document.entities).every(ref=>ref.startsWith(`${expressionRef}:entity:`)&&ref.slice(`${expressionRef}:entity:`.length).length<=128));
check("Expression-local scene refs",document.scenes.every(s=>s.scene_ref.startsWith(`${expressionRef}:scene:`)));
check("current kernel per-scene budget",document.scenes.every(s=>s.entity_refs.length<=10));
check("all entities are scene-addressable",new Set(document.scenes.flatMap(s=>s.entity_refs)).size===entities.length);
check("every native node",Object.values(run.runMap.nodes).every(n=>subjects.has(`${run.runRef}#${n.id}`)));
check("every native node kind",Object.values(run.runMap.nodes).every(n=>entities.some(e=>e.subject?.subject_ref===`${run.runRef}#${n.id}`&&e.subject.readings.some(r=>r.ref===`factory.run-node/${n.kind}`))));
check("every edge and exact native endpoints",run.runMap.edges.every(edge=>relations.some(r=>r.relation.ref===`factory.run-edge/${edge.relation}`&&document.entities[r.from_entity_ref].subject.subject_ref===`${run.runRef}#${edge.from}`&&document.entities[r.to_entity_ref].subject.subject_ref===`${run.runRef}#${edge.to}`)));
check("native gates and barriers",Object.values(run.runMap.nodes).filter(n=>n.kind.toLowerCase()==="gate").every(n=>subjects.has(`${run.runRef}#${n.id}`)));
check("every compiled unit",units.units.every(u=>subjects.has(u.workflowUnitRef)));
check("disclosed Run Action targets remain native",root.actions.every(a=>a.target_ref===run.runRef&&(run.actions??[]).some(native=>native.actionRef===a.action_ref)));
if(attempt){
  check("every native attempt",attempt.attempts.every(a=>subjects.has(a.attemptRef)));
  check("every verification and its outcome",attempt.attempts.every(a=>(a.verifications??[]).every(v=>entities.some(e=>e.subject?.subject_ref===a.attemptRef&&e.subject.readings.some(r=>r.ref===`factory.verification/${v.outcome}`&&r.revision===v.verificationRef)))));
  check("all Returns, not only the first",attempt.attempts.filter(a=>a.readableReturn).every(a=>subjects.has(a.readableReturn.returnRef)));
  check("all returned artifacts/evidence/receiving refs",attempt.attempts.filter(a=>a.readableReturn).every(a=>[...(a.readableReturn.artifactRefs??[]),...(a.readableReturn.evidenceRefs??[]),...(a.readableReturn.receivingRef?[a.readableReturn.receivingRef]:[])].every(ref=>subjects.has(ref))));
}else{
  check("explicit native attempt absence",Boolean(attemptsSkipped));
  check("no invented attempt scene",!document.scenes.some(s=>s.scene_ref.endsWith(":scene:executions-1")));
}
if(output)await writeFile(output,JSON.stringify(document,null,2)+"\n",{flag:"wx",mode:0o600});
console.log(JSON.stringify({schema:"oi.factory-cli-projection-check/v1",runRef,expression:expressionRef,entities:entities.length,relations:relations.length,scenes:document.scenes.length,attemptsSkipped,checks,standing:"native-cli-projection-only",documentOutput:output??null}));
