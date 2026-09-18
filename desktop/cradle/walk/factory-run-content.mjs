import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
const statePath=process.env.WALK_FACTORY_STATE;
const runRef=process.env.WALK_FACTORY_RUN;
const projectRef=process.env.WALK_FACTORY_PROJECT_REF;
const projectName=process.env.WALK_PROJECT??"O-I";
if(!statePath||!runRef||!projectRef)throw new Error("Set WALK_FACTORY_STATE, WALK_FACTORY_RUN and WALK_FACTORY_PROJECT_REF to the real retained empty Run and its Central Project.");
const browser=await chromium.launch({executablePath:process.env.WALK_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1422,height:858}});
const errors=[],responses=[],checks=[];
let buildReadCount=0;
async function waitFor(predicate,message,timeoutMs=5_000){
 const deadline=Date.now()+timeoutMs;
 while(!predicate()){
  if(Date.now()>=deadline)throw new Error(message);
  await new Promise(resolve=>setTimeout(resolve,50));
 }
}
page.on("pageerror",error=>errors.push(String(error)));
page.on("response",async response=>{if(response.url().endsWith("/op")){try{const request=response.request().postDataJSON();if(request.op.startsWith("factory_")){const result=await response.json();responses.push({request,result});if(result.outcome?.data?.contract==="factory.build-view/v1")buildReadCount+=1;}}catch{}}});
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log("PASS",name)};
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});
try{
 await page.goto(process.env.WALK_URL??"http://localhost:4173");
 await page.getByRole("button",{name:projectName,exact:true}).click();
 await page.getByRole("navigation",{name:projectName+" work",exact:true}).getByRole("button",{name:"Runs / Build",exact:true}).click();
 const runs=page.getByRole("region",{name:"Factory Runs and Build"});
 await runs.locator(".factory-source-picker summary").click();
 await runs.getByLabel("Developmental state path",{exact:true}).fill(statePath);
 await runs.getByLabel("Central Project ref",{exact:true}).fill(projectRef);
 await runs.getByLabel("Run ref (optional)",{exact:true}).fill(runRef);
 await runs.getByRole("button",{name:"Read Runs",exact:true}).click();
 await runs.locator(".fb-build-surface").waitFor({timeout:20000});
 const nativeBuild=responses.findLast(row=>row.result.outcome?.data?.contract==="factory.build-view/v1")?.result.outcome.data;
 check(nativeBuild?.view.run.runRef===runRef,"Native Build retains the selected Run identity");
 check(await runs.locator(".fb-header h1").innerText()===nativeBuild.view.run.label,"Displays actual Factory Run destination");
 check((await runs.locator(".fb-run-sentence").innerText()).trim().length>0,"The header speaks the Run's stage as a sentence");
 check(await runs.locator(".fb-review-card").count()===0,"No Candidate is fabricated for an empty Run");
 check(await runs.getByText("No execution has been recorded for this Run.",{exact:true}).count()===1,"Actual empty execution state is not fabricated");
 await runs.locator("details.fb-workmap > summary").click();
 const nativeRun=responses.findLast(row=>row.result.outcome?.data?.contract==="factory.run-reading/v1")?.result.outcome.data;
 check(nativeRun?.runRef===runRef,"Native Run Map retains the selected Run identity");
 const workNode=Object.values(nativeRun.runMap.nodes).find(node=>node.kind==="work");
 check(Boolean(workNode),"Native Run Map discloses an actual work node");
 const runMap=runs.getByRole("region",{name:"Factory Run map"});
 await runMap.getByRole("button",{name:new RegExp(workNode.label,"i")}).click();
 const selectedNode=runMap.getByRole("article",{name:"Selected node: "+workNode.label});
 check(await selectedNode.count()===1,"Selects the actual Factory work node");
 await selectedNode.getByText("Native semantic reference",{exact:true}).click();
 check(await selectedNode.locator("code").filter({hasText:workNode.semanticRef}).count()===1,"Shows the exact native semantic reference");
 const incoming=nativeRun.runMap.edges.filter(edge=>edge.to===workNode.id);
 check(incoming.length===1,"Native Run Map supplies the work-node dependency edge");
 const relationLabel=incoming[0].relation.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
 check(await selectedNode.getByRole("heading",{name:"Incoming",exact:true}).count()===1,"Renders the selected node incoming dependency");
 check(await selectedNode.getByText(relationLabel,{exact:true}).count()>=1,"Renders the native dependency relation");
 const priorBuildReads=responses.filter(row=>row.result.outcome?.data?.contract==="factory.build-view/v1").length;
 await runs.getByRole("button",{name:"Refresh",exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll(".fb-build-surface.factory-build").length===1);
 await waitFor(()=>buildReadCount>priorBuildReads,"Refresh did not re-read the native Factory Build");
 check(buildReadCount>priorBuildReads,"Refresh re-reads the native Factory Build");
 check(await runMap.getByRole("article",{name:"Selected node: "+workNode.label}).count()===1,"Run Map selection survives the Build refresh");
 check(responses.some(row=>row.result.outcome?.data?.contract==="factory.central-project-link-reading/v1"),"Reads canonical Central-to-Factory project link");
 check(responses.some(row=>row.result.outcome?.data?.contract==="factory.build-view/v1"),"Reads native Factory Build");
 await page.screenshot({path:"walk/artifacts/factory-run-content-20260918.png"});
 await page.getByRole("navigation",{name:projectName+" work",exact:true}).getByRole("button",{name:"Agents",exact:true}).click();
 const agents=page.getByRole("region",{name:"Project Agents"});
 const catalogue=await (await fetch("http://127.0.0.1:4179/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"central_actions_read"})})).json();
 assert.equal(catalogue.outcome?.result,"central_actions_reading");
 assert.ok(Array.isArray(catalogue.outcome.data.actions));
 const expression=catalogue.outcome.data.actions.find(action=>action.id==="agent-profile.express");
 await page.waitForFunction(()=>document.querySelector(".agents-roster > header button")?.disabled===false);
 if(expression?.availability?.available===true){
 await agents.locator("summary").filter({hasText:"Express an AgentProfile intent"}).click();
 check(await agents.getByLabel("Intent",{exact:true}).isVisible(),"Agent creation exposes the human intent");
 check(await agents.locator(".agents-expression-intent").evaluate(element=>!!(element.compareDocumentPosition(element.parentElement.querySelector("select"))&Node.DOCUMENT_POSITION_FOLLOWING)),"Intent precedes scope in reading and keyboard order");
 check(await agents.locator("summary").filter({hasText:"Optional purpose and role"}).evaluate(element=>element.parentElement.open===false),"Optional profile defaults are disclosed on request");
 check(await agents.getByRole("button",{name:"Express AgentProfile intent",exact:true}).isDisabled(),"Incomplete intent does not submit an Agent proposal");
 }else{
  check(await agents.locator("summary").filter({hasText:"Express an AgentProfile intent"}).count()===0,"No Agent Expression form is offered when the real owner catalogue does not advertise its operation");
  check(await agents.getByRole("button",{name:"Express AgentProfile intent",exact:true}).count()===0,"Absent native intent operation cannot become a fabricated proposal");
 }
 responses.push({request:{op:"central_actions_read"},agentExpression:expression??null});
 check(errors.length===0,"No application page errors");
 writeFileSync("walk/artifacts/factory-run-content-20260918.json",JSON.stringify({standing:"C: actual application and native Factory executable; retained Run has no execution or Candidate, not positive joined-work proof",checks,errors,responses},null,2));
}catch(error){console.log((await page.locator("body").innerText()).slice(-6500));await page.screenshot({path:"/tmp/oi-u-factory-run-content-failure.png"});throw error;}finally{await browser.close();}
