import {chromium} from "playwright";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,writeFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";

const FACTORY="/home/frank/Central/Work/Factory/.worktrees/codex-developmental-build-read/target/debug/factory";
const FACTORY_SHA256="a48c87ecb43244faef73e8c231f70594a738c7469e943cd0c1e7356cfe6dc133";
const WORKFLOW_FIXTURE="/home/frank/Central/Work/Factory/.worktrees/codex-developmental-build-read/contracts/factory/fixtures/oi-self-hosting-workflow-mutation.json";
const CENTRAL_PROJECT_REF="project:o-i";
const SCRIPT_DIR=dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR=join(SCRIPT_DIR,"artifacts/factory-live-continuation-20260915");
const BRIDGE="http://127.0.0.1:4179";
const WALK_URL=process.env.WALK_URL||"http://localhost:4173";
const PROJECT_NAME=process.env.WALK_PROJECT||"O-I";
const checks=[],errors=[],requests=[],tempDirs=[];
assert.equal(createHash("sha256").update(readFileSync(FACTORY)).digest("hex"),FACTORY_SHA256,"pinned frozen Factory executable");
const native=args=>JSON.parse(execFileSync(FACTORY,args.concat(["--json"]),{encoding:"utf8"}));
const makeState=label=>{
 const dir=mkdtempSync(join(tmpdir(),label));tempDirs.push(dir);
 const statePath=join(dir,"developmental-state.json");
 const manifest=JSON.parse(execFileSync(FACTORY,["conformance","developmental-state",statePath,"--json"],{encoding:"utf8"}));
 const linkPath=join(dir,"central-project-link.json");
 writeFileSync(linkPath,JSON.stringify({contract:"factory.central-project-link-request/v1",factoryProjectRef:manifest.projectRef,centralProjectRef:CENTRAL_PROJECT_REF,sourcePath:"/home/frank/Central/Work/O-I/ProjectCentral/project.json"},null,2));
 assert.equal(native(["development","central-project-link",statePath,linkPath]).result,"applied","real Central link admitted into isolated state");
 return Object.assign(manifest,{statePath,dir});
};
const makeWorkflowMutation= (state,suffix)=>{
 const request=JSON.parse(readFileSync(WORKFLOW_FIXTURE,"utf8"));
 request.mutationRef="mutation:factory-live-updates-"+suffix;
 request.occurrenceRef="occurrence:factory-live-updates-"+suffix;
 request.mutation.runRef=state.runRef;
 const path=join(state.dir,suffix+".json");writeFileSync(path,JSON.stringify(request,null,2));return path;
};
const runRead=state=>native(["development","run",state.statePath,state.runRef]);
const attemptRead=state=>native(["attempt","list",state.statePath,state.runRef]);
const cleanup=()=>{for(const dir of tempDirs)rmSync(dir,{recursive:true,force:true});};
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log("PASS",label);};
mkdirSync(ARTIFACT_DIR,{recursive:true});

// Prove the actual transition first in a disposable native state.
const proof=makeState("factory-live-proof-");
const proofRunBefore=runRead(proof),proofAttemptBefore=attemptRead(proof);
const proofReceipt=native(["development","mutate",proof.statePath,makeWorkflowMutation(proof,"proof")]);
const proofRunAfter=runRead(proof),proofAttemptAfter=attemptRead(proof);
assert.equal(proofReceipt.status,"applied","frozen Factory accepts the owner workflow mutation");
assert.equal(proofRunAfter.revision,proofRunBefore.revision+1,"native Run revision advances");
assert.equal(proofRunAfter.runMap.topologyRevision,proofRunBefore.runMap.topologyRevision+1,"native RunMap revision advances");
assert.equal(proofAttemptAfter.runRevision,proofAttemptBefore.runRevision+1,"attempt list discloses the Run revision transition");
checks.push("Native isolated workflow revision transition verified before browser walk");

const state=makeState("factory-live-walk-");
const initialRun=runRead(state),initialAttempt=attemptRead(state);
assert.equal(initialRun.candidates.length,0,"selected isolated Run starts with no candidates");
assert.equal(initialRun.evidence.length,0,"selected isolated Run starts with no evidence");
assert.equal(initialAttempt.taskRefs.length,0,"selected isolated Run starts with no tasks");
const mutationPath=makeWorkflowMutation(state,"live");

const browser=await chromium.launch({headless:true,executablePath:process.env.WALK_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1422,height:858}});
page.on("pageerror",e=>errors.push(String(e)));
page.on("request",r=>{if(r.url().endsWith("/op"))try{requests.push(r.postDataJSON());}catch{}});
const stateRequests=()=>requests.filter(r=>r.state_path===state.statePath);
const countRead=read=>stateRequests().filter(r=>r.op==="factory_development_read"&&r.read===read).length;
const countLists=()=>stateRequests().filter(r=>r.op==="factory_attempt_task_list_read").length;
const readLayout=()=>page.evaluate(()=>{const book=JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1")||"null");const active=book&&book.workspaces.find(w=>w.id===book.active);return active&&active.layout;});
await page.addInitScript(bridge=>{window.__OI_KERNEL_BRIDGE__=bridge;sessionStorage.setItem("oi-cradle.welcome.v1","1");},BRIDGE);
try {
 await page.goto(WALK_URL,{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:PROJECT_NAME,exact:true}).click();
 const start=page.getByRole("button",{name:"Start writing",exact:true});if(await start.count())await start.click();
 const nav=page.getByRole("navigation",{name:PROJECT_NAME+" work",exact:true});
 await nav.getByRole("button",{name:"Runs / Build",exact:true}).click();
 const runs=page.getByRole("region",{name:"Factory Runs and Build",exact:true});await runs.waitFor();
 const picker=runs.locator("details.factory-source-picker");if(!(await picker.evaluate(e=>e.open)))await picker.locator("summary").click();
 const missingPath=join(state.dir,"missing.json");
 await runs.getByLabel("Developmental state path",{exact:true}).fill(missingPath);
 await runs.getByLabel("Central Project ref",{exact:true}).fill(CENTRAL_PROJECT_REF);
 await runs.getByLabel("Run ref (optional)",{exact:true}).fill(state.runRef);
 await runs.getByRole("button",{name:"Read Runs",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector(".factory-updates")?.textContent?.includes("Run updates unavailable"),null,{timeout:20000});
 check(true,"Initial missing state reports Run updates unavailable");
 await runs.getByLabel("Developmental state path",{exact:true}).fill(state.statePath);
 await runs.getByLabel("Central Project ref",{exact:true}).fill(CENTRAL_PROJECT_REF);
 await runs.getByLabel("Run ref (optional)",{exact:true}).fill(state.runRef);
 await runs.getByRole("button",{name:"Read Runs",exact:true}).click();
 await runs.locator(".fb-build-surface").waitFor({timeout:20000});
 check(await runs.getByText("No candidate has been retained for this Run.",{exact:true}).count()===1,"Initial Candidate state is owner-reported empty");
 check(await runs.getByText(/No evidence (has been retained for this Run.|recorded.)/).count()===1,"Initial Evidence state is owner-reported empty");
 await page.getByRole("tab",{name:"Draft",exact:true}).click();
 const draft=page.locator(".cm-content"),draftText="Live Factory workflow metadata leaves ordinary work untouched.";
 await draft.fill(draftText);
 const beforeLayout=JSON.stringify(await readLayout()),beforeBuildReads=countRead("build"),beforeRunReads=countRead("run"),beforeLists=countLists();
 await page.waitForTimeout(5500);
 check(countRead("build")===beforeBuildReads,"Unchanged 5-second index poll does not fetch Build");
 check(countLists()>beforeLists,"Unchanged interval performs a compact native index poll");
 check(countRead("run")===beforeRunReads,"Unchanged 5-second index poll does not fetch Run");
 check(await draft.innerText()===draftText,"Draft remains mounted before arrival");

 const mutationOutput=execFileSync(FACTORY,["development","mutate",state.statePath,mutationPath,"--json"],{encoding:"utf8"});
 assert.equal(JSON.parse(mutationOutput).status,"applied","browser transition uses a real native workflow receipt");
 const nativeAfter=runRead(state);
 check(nativeAfter.revision===initialRun.revision+1,"Native Run revision advances during browser walk");
 check(nativeAfter.runMap.topologyRevision===initialRun.runMap.topologyRevision+1,"Native RunMap revision advances during browser walk");
 await page.getByLabel("Factory updates",{exact:true}).waitFor({timeout:20000});
 check((await page.getByLabel("Factory updates",{exact:true}).innerText()).includes("Run updated"),"Footer reports Run updated");
 check(await draft.isVisible(),"Draft remains mounted during update");
 check(await draft.innerText()===draftText,"Draft text survives background update");
 check(JSON.stringify(await readLayout())===beforeLayout,"Background update preserves focus and persisted layout");
  await page.screenshot({path:join(ARTIFACT_DIR,"factory-live-updated.png")});
 check(countRead("run")>beforeRunReads,"Changed revision fetches selected Run");

 const moved=state.statePath+".moved";renameSync(state.statePath,moved);
 await page.waitForFunction(()=>document.querySelector(".factory-updates")?.textContent?.includes("Live updates unavailable"),null,{timeout:20000});
 check(true,"Owner refusal appears when only scratch state is moved");
 renameSync(moved,state.statePath);
 await page.waitForFunction(()=>!document.querySelector(".factory-updates")?.textContent?.includes("Live updates unavailable"),null,{timeout:20000});
 check(true,"Restoring scratch state clears owner refusal after a real read");

 const updates=page.getByLabel("Factory updates",{exact:true}),details=updates.locator("xpath=..");
 if(!(await details.evaluate(e=>e.open)))await updates.click();
 const openRun=page.getByRole("button",{name:"Open Run",exact:true});
 await openRun.waitFor({timeout:5000});
 const hitDiagnostic=await openRun.evaluate(el=>{const rect=el.getBoundingClientRect();const point={x:rect.left+rect.width/2,y:rect.top+rect.height/2};const hit=document.elementFromPoint(point.x,point.y);const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};const styles=e=>{if(!e)return null;const s=getComputedStyle(e);return {position:s.position,zIndex:s.zIndex,overflow:s.overflow,transform:s.transform,opacity:s.opacity,pointerEvents:s.pointerEvents};};const ancestors=[];for(let e=el;e&&ancestors.length<8;e=e.parentElement)ancestors.push({tag:e.tagName,id:e.id,className:e.className,box:box(e),styles:styles(e)});return {button:{...box(el),text:el.textContent?.trim(),role:el.getAttribute("role"),styles:styles(el)},point,hit:hit?{tag:hit.tagName,id:hit.id,className:hit.className,role:hit.getAttribute("role"),text:hit.textContent?.trim().slice(0,160),box:box(hit),styles:styles(hit)}:null,activeTab:document.querySelector("[role=tab][aria-selected=true]")?.textContent?.trim(),buttonOwnsHit:el.contains(hit),ancestors};});
 writeFileSync(join(ARTIFACT_DIR,"factory-open-run-hit-target.json"),JSON.stringify(hitDiagnostic,null,2));
 await page.screenshot({path:join(ARTIFACT_DIR,"factory-open-run-hit-target.png")});
 console.log("OPEN RUN HIT DIAGNOSTIC",JSON.stringify(hitDiagnostic));
 check(hitDiagnostic.buttonOwnsHit,"Open Run button owns its center hit target");
 await openRun.click();
 await runs.locator(".fb-build-surface").waitFor({timeout:20000});
 check((await runs.locator(".factory-run-map-head").innerText()).includes(Object.keys(nativeAfter.runMap.nodes).length + " nodes"),"Explicit Run refresh renders native workflow topology");
 check(countRead("build")>beforeBuildReads,"Explicit Open Run performs native Build refresh");
 check(await runs.getByText("No candidate has been retained for this Run.",{exact:true}).count()===1,"Explicit refresh preserves actual empty Candidate state");
 await page.getByRole("tab",{name:"Draft",exact:true}).click();
 check(await page.locator(".cm-content").innerText()===draftText,"Explicit Run opening preserves ordinary draft text");

 await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
 const settledLists=countLists();await page.waitForTimeout(6000);
 check(countLists()===settledLists,"Leaving Factory stops selected-Run polling");
 check(errors.length===0,"No application page errors");
 writeFileSync(join(ARTIFACT_DIR,"factory-live-updates.json"),JSON.stringify({standing:"C: real browser, exact frozen Factory binary, isolated state; no execution/evidence/Return/recognition asserted",binary:FACTORY,binarySha256:FACTORY_SHA256,projectRef:state.projectRef,centralProjectRef:CENTRAL_PROJECT_REF,runRef:state.runRef,journeyRef:state.journeyRef,native:{proofRunBefore,proofRunAfter,proofAttemptBefore,proofAttemptAfter,proofReceipt,initialRun,initialAttempt,nativeAfter},checks,errors,requests:stateRequests()},null,2));
} catch(error) {console.error((await page.locator("body").innerText()).slice(-5000));throw error;}
finally {await browser.close();cleanup();}
