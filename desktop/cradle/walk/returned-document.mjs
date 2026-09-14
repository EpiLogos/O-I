import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";

const statePath=process.env.WALK_FACTORY_STATE;
const runRef=process.env.WALK_FACTORY_RUN;
const requestedTask=process.env.WALK_FACTORY_TASK;
assert.ok(statePath&&runRef,"Supply WALK_FACTORY_STATE and WALK_FACTORY_RUN for an actual Factory Run.");

const bridge="http://127.0.0.1:4179";
const readOwner=async(op,input,resultName)=>{
  const response=await fetch(bridge+"/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op,...input})});
  assert.ok(response.ok,"Native bridge responded to "+op);
  const result=await response.json();
  assert.equal(result.outcome?.result,resultName,"Native owner returned "+resultName);
  return result.outcome.data;
};

const listed=await readOwner("factory_attempt_task_list_read",{state_path:statePath,run_ref:runRef},"factory_attempt_task_list_reading");
const taskRefs=requestedTask?[requestedTask]:listed.taskRefs;
assert.ok(taskRefs.length>0,"This walk requires a real retained Factory task; the supplied Run has none.");
let selected;
for(const taskRef of taskRefs){
  const reading=await readOwner("factory_attempt_task_read",{state_path:statePath,run_ref:runRef,task_ref:taskRef},"factory_attempt_task_reading");
  const attempt=reading.attempts.find(item=>item.record?.readableReturn&&item.record.readableReturn.artifactRefs?.length>0&&item.record.verifications?.length>0);
  if(attempt){selected={taskRef,reading,attempt};break;}
}
assert.ok(selected,"This walk requires an actual retained readable Return with an artifact and verification receipt; no supplied Factory task disclosed both.");

const browser=await chromium.launch({headless:true,executablePath:process.env.WALK_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1422,height:858}});
const checks=[],errors=[];
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log("PASS",name);};
page.on("pageerror",error=>errors.push(String(error)));
const baseUrl=process.env.WALK_URL??"http://localhost:4173";
await page.context().grantPermissions(["clipboard-read","clipboard-write"],{origin:new URL(baseUrl).origin});
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});

try {
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"O-I",exact:true}).click();
  const nav=page.getByRole("navigation",{name:"O-I work",exact:true});
  await nav.getByRole("button",{name:"Runs / Build",exact:true}).click();
  const runs=page.getByRole("region",{name:"Factory Runs and Build",exact:true});
  await runs.getByText("Connect Factory source",{exact:true}).click();
  await runs.getByLabel("Developmental state path").fill(statePath);
  await runs.getByLabel("Run ref (optional)").fill(runRef);
  await runs.getByRole("button",{name:"Read Runs",exact:true}).click();
  await runs.getByRole("button",{name:"Open handoff",exact:true}).click();

  const handoff=page.getByRole("region",{name:"Factory handoff",exact:true});
  const taskNav=handoff.getByRole("navigation",{name:"Retained Factory tasks",exact:true});
  if(await taskNav.count()) await taskNav.getByRole("button",{name:selected.taskRef,exact:true}).click();

  const returned=selected.attempt.record.readableReturn;
  const verification=selected.attempt.record.verifications[0];
  const document=handoff.locator(".returned-document").filter({hasText:returned.summary}).first();
  await document.waitFor({state:"visible",timeout:120000});
  check(await document.getByRole("heading",{level:2,name:returned.summary,exact:true}).count()===1,"A real Factory readable Return is projected with the owner's exact summary");

  const identity=document.locator(".returned-document-header .returned-document-reference");
  check(await identity.count()===1&&await identity.getAttribute("open")===null&&await document.locator(".returned-document-header > code").count()===0,"The native task identity is disclosed on demand rather than crowding the Return heading");
  await identity.locator("summary").click();
  check(await identity.locator("code").innerText()===selected.taskRef,"Document identity disclosure retains the exact Factory task reference");

  const material=document.locator(".returned-document-material li").filter({hasText:"Artifact 1"}).first();
  await material.waitFor();
  const materialRef=material.locator(".returned-document-reference");
  check(await materialRef.getAttribute("open")===null&&await material.getByRole("button").count()===0,"An opaque native artifact stays unopened until its owner supplies an opener");
  await materialRef.locator("summary").click();
  check(await materialRef.locator("code").innerText()===returned.artifactRefs[0],"Material disclosure retains the exact Factory artifact reference");

  const evidence=document.locator(".returned-document-evidence > li").filter({hasText:"Verification \u00b7 "+verification.ownerRef}).first();
  await evidence.waitFor();
  check(await evidence.getAttribute("data-standing")===verification.outcome,"Verification standing is the exact retained Factory receipt outcome");
  const evidenceRefs=evidence.locator(".returned-document-evidence-refs");
  check(await evidenceRefs.getAttribute("open")===null,"Verification references begin disclosed rather than crowding the verification finding");
  await evidenceRefs.locator("summary").click();
  check(await evidenceRefs.locator("code").first().innerText()===verification.verificationRef,"Verification disclosure retains the owner receipt reference");

  const provenance=document.locator(".returned-document-provenance");
  check(await provenance.getAttribute("open")===null,"Source basis is initially a compact disclosure");
  await provenance.locator("summary").click();
  check(await provenance.getByText(selected.reading.workflowSourceRef,{exact:true}).isVisible()&&await provenance.getByText(selected.reading.workflowSourceRevision,{exact:true}).isVisible(),"Provenance retains the exact Factory workflow source and revision");

  const expectedPrompt="Resume task "+selected.taskRef+" in Run "+runRef+" from "+selected.reading.workflowSourceRef+" @ "+selected.reading.workflowSourceRevision+"; read the current Factory attempt state before taking any action.";
  const continuation=document.locator(".returned-document-continuations li").filter({hasText:expectedPrompt}).first();
  await continuation.waitFor();
  const copy=continuation.getByRole("button",{name:"Copy",exact:true});
  await copy.click();
  await continuation.getByRole("button",{name:"Copied",exact:true}).waitFor();
  check(await continuation.getByRole("status").innerText()==="Copied.","The actual O:I continuation copy reports completion");
  check(await page.evaluate(()=>navigator.clipboard.readText())===expectedPrompt,"The actual continuation text reaches the browser clipboard exactly");

  check(errors.length===0,"No application errors while rendering or copying the native Return");
  await page.screenshot({path:"walk/artifacts/returned-document-native.png"});
  writeFileSync("walk/artifacts/returned-document-native.json",JSON.stringify({
    standing:"C: real application, native Factory retained Return and browser clipboard; no Factory execution or verification claim beyond owner receipt standing",
    checks,
    errors,
    source:{statePath,runRef,taskRef:selected.taskRef,attemptRef:selected.attempt.record.attemptRef,returnRef:returned.returnRef,verificationRef:verification.verificationRef,verificationStanding:verification.outcome}
  },null,2));
} catch(error) {
  console.error(errors);
  console.error((await page.locator("body").innerText()).slice(-5500));
  await page.screenshot({path:"walk/artifacts/returned-document-native-failure.png"});
  throw error;
} finally { await browser.close(); }
