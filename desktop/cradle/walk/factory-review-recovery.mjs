// Real app + native owner refusal/recovery. No populated result is fabricated.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
const statePath=process.env.WALK_FACTORY_STATE,runRef=process.env.WALK_FACTORY_RUN;
assert.ok(statePath&&runRef,"Supply the authorised actual Factory state and Run");
const bridge="http://127.0.0.1:4179",checks=[],requests=[],errors=[];
const artifactDir="walk/artifacts/factory-review-continuation-20260915";
mkdirSync(artifactDir,{recursive:true});
const native=await (await fetch(bridge+"/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"factory_attempt_task_list_read",state_path:statePath,run_ref:runRef})})).json();
assert.equal(native.outcome?.result,"factory_attempt_task_list_reading");
assert.deepEqual(native.outcome.data.taskRefs,[],"The authorised Run remains genuinely empty");
const browser=await chromium.launch({headless:true,executablePath:process.env.WALK_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1422,height:858}});
page.on("pageerror",error=>errors.push(String(error)));
page.on("request",request=>{if(request.url().endsWith("/op")){try{requests.push(request.postDataJSON());}catch{}}});
await page.addInitScript(()=>{
 window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";
 sessionStorage.setItem("oi-cradle.welcome.v1","1");
 const input=sessionStorage.getItem("factory-review.seed");
 if(input){const {kind,statePath,runRef}=JSON.parse(input);
   const key="oi-cradle.workspaces.v1",book=JSON.parse(localStorage.getItem(key));
   const layout=book.workspaces.find(w=>w.id===book.active).layout;
   const draft=Object.values(layout.surfaces).find(s=>s.kind==="draft");
   const id="review-recovery-"+kind;
   layout.surfaces[id]={id,kind,title:"Retained review recovery",project:"O-I",ref:kind==="factory-handoff"?runRef:"candidate:unretained-review-recovery",view:{factory:{statePath,runRef,...(kind==="factory-handoff"?{handoffSnapshot:{damaged:true}}:{materialSnapshot:{damaged:true}})}}};
   layout.root={type:"group",id:"review-recovery-pane",tabs:[draft.id,id],pinned:[],active:id};
   layout.focusedGroupId=layout.root.id;delete layout.composition;delete layout.maximizedGroupId;
   localStorage.setItem(key,JSON.stringify(book));
 sessionStorage.removeItem("factory-review.seed");}
});
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
const reads=()=>requests.filter(row=>row?.state_path===statePath&&["factory_development_read","factory_attempt_task_list_read","factory_attempt_task_read"].includes(row.op));
try {
 await page.goto(process.env.WALK_URL??"http://localhost:4173",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Start writing",exact:true}).click();
 await page.locator(".cm-content").fill("Review recovery preserves ordinary work.");
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1")??"null")?.workspaces?.some(w=>Object.values(w.layout.surfaces).some(s=>s.kind==="draft")));
 for(const kind of ["factory-handoff","factory-material"]){
  await page.evaluate(value=>sessionStorage.setItem("factory-review.seed",JSON.stringify(value)),{kind,statePath,runRef});
  const before=reads().length;
  await page.reload({waitUntil:"domcontentloaded"});
  const surface=page.getByRole("region",{name:kind==="factory-handoff"?"Factory handoff":"Factory material",exact:true});
  await surface.getByRole("alert").filter({hasText:"retained Factory review cannot be restored"}).waitFor();
  check(await page.locator(".workspace-recovery").count()===0,kind+": damaged review preserves the workspace");
  check(await page.getByRole("tab",{name:"Draft",exact:true}).count()===1,kind+": ordinary work retains its tab");
  await page.waitForTimeout(1100);
  check(reads().length===before,kind+": no automatic current-owner read replaces damaged material");
  await surface.getByRole("button",{name:kind==="factory-handoff"?"Refresh retained tasks":"Refresh native read",exact:true}).click();
  await page.waitForFunction(({kind})=>kind==="factory-handoff"?document.body.textContent.includes("No retained Factory handoff for this Run."):document.body.textContent.includes("does not retain Candidate or Evidence"),{kind});
  check(reads().length===before+1,kind+": explicit Refresh performs one real owner read");
  await page.waitForTimeout(1100);
  check(reads().length===before+1,kind+": refresh settles without a read loop");
  check(await surface.locator(".returned-document").count()===0,kind+": actual empty/missing material is never fabricated");
  await page.screenshot({path:artifactDir+"/"+kind+"-recovery.png"});
  await page.getByRole("tab",{name:"Draft",exact:true}).click();
  check((await page.locator(".cm-content").innerText()).includes("Review recovery preserves ordinary work."),kind+": original draft survives explicit recovery");
 }
 check(errors.length===0,"No application page errors");
 writeFileSync(artifactDir+"/factory-review-recovery.json",JSON.stringify({standing:"C: production browser and real native Factory reads; corrupted presentation snapshots are refusal tests. No populated Candidate/Handoff or execution acceptance.",checks,errors,native:native.outcome.data,requests:reads()},null,2));
} catch(error){await page.screenshot({path:artifactDir+"/recovery-failure.png"});console.error((await page.locator("body").innerText()).slice(-3500));throw error;}finally{await browser.close();}
