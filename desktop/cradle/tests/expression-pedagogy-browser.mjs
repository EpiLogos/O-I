import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
const cradle=fileURLToPath(new URL("../",import.meta.url));
const root=fileURLToPath(new URL("../../../",import.meta.url));
const bridge="http://127.0.0.1:4194",app="http://localhost:4294";
const services=[];const start=(cmd,args,options={})=>{const child=spawn(cmd,args,{cwd:cradle,stdio:["ignore","pipe","pipe"],...options});services.push(child);return child;};
const wait=async url=>{const end=Date.now()+180000;while(Date.now()<end){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error(`timed out: ${url}`);};
const stop=()=>services.reverse().forEach(child=>{if(child.exitCode===null)child.kill("SIGTERM");});
const op=async request=>{const response=await fetch(`${bridge}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op:"expression",request})});const body=await response.json();assert.equal(body.ok,true,body.error);return body.outcome.data;};
const hash=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
let browser;
try{
 start("cargo",["run","--quiet","--manifest-path","kernel/Cargo.toml","--bin","walk-bridge","--","127.0.0.1:4194"],{env:{...process.env,CARGO_INCREMENTAL:"0",OI_AIKIT_BIN:"/Users/admin/.cargo/bin/aikit",OI_CENTRAL_CTRL_BIN:"/Users/admin/.local/bin/ctrl"}});
 start("npx",["vite","--port","4294","--strictPort"],{env:{...process.env,VITE_KERNEL_BRIDGE:bridge}});
 await Promise.all([wait(`${bridge}/state`),wait(app)]);
 browser=await chromium.launch({headless:true,channel:"chrome"});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on("pageerror",error=>errors.push(String(error)));
 await page.goto(app);await page.waitForTimeout(12000);await page.locator(".oi-welcome-enter").click({timeout:30000}).catch(()=>{});await page.getByRole("button",{name:"Start writing",exact:true}).click();await page.getByLabel("Full right region").evaluate(button=>button.click());await page.getByText("Composition",{exact:true}).evaluate(button=>button.click());
 await page.getByRole("heading",{name:"Expressions"}).waitFor({state:"attached"});await page.getByLabel("Expression title").fill("Epii source movement");await page.getByRole("button",{name:"New Expression"}).click({force:true});
 const adapterChecks=await page.evaluate(async()=>{
  const {compilePedagogy}=await import("/src/expression/pedagogy.ts");
  const reading={ref:"central:source:test",revision:"exact",availability:"available"};
  const base={summary:"Disclosure check",motions:[],method_refs:[reading],evidence_refs:[reading]};
  const scene=subject=>[{scene_ref:"expression:x:scene:main",title:"Opening",existing:true,entities:[{entity_ref:"expression:x:entity:s",title:"Subject",x:0,y:0,subject}]}];
  let personalRefused=false,agentRefused=false;
  try{compilePedagogy({...base,scenes:scene({kind:"personal_page",native_owner:"personal-web",page:{profile:"oi.page/v1",meta:{family:"beings",revision:0},bindings:{subjectRef:null,sources:[]}}})});}catch{personalRefused=true;}
  const absent={availability:"unavailable"};
  try{compilePedagogy({...base,scenes:scene({kind:"agent",reading:{agentSessionRef:"agent-session/actual",owner:"ai-kit",identity:reading,agentRef:absent,personality:absent,presence:absent,currentSubject:absent,activity:absent,methods:absent,capabilities:absent}})});}catch{agentRefused=true;}
  const binding={subject_ref:"central:source:test",native_owner:"central",presentation_role:"thing",sources:[reading],readings:[],actions:[]};
  const compiled=compilePedagogy({...base,scenes:scene({kind:"binding",binding}),motions:[{entity_ref:"expression:x:entity:s",parameter:"x",intent:"move into relation",from:-10,to:10,duration_seconds:5,waveform:"triangle"}]});
  return {personalRefused,agentRefused,rate:compiled.changes.find(change=>change.change==="parameter_automate")?.automation.rate_hz};
 });
 assert.deepEqual(adapterChecks,{personalRefused:true,agentRefused:true,rate:0.2});
 const editor=page.getByRole("region",{name:"Expression composition"});await page.waitForFunction(()=>document.querySelector(".expression-editor")?.textContent?.includes("Epii source movement"));const expressionRef=await editor.getAttribute("data-expression-ref");assert.ok(expressionRef?.startsWith("expression:"));
 const sourceRef="central:source:project:project:o-i:docs/cradle/EXPRESSION-FIELD.md",sourceRevision=hash(`${root}docs/cradle/EXPRESSION-FIELD.md`),methodRef="skill/personal/central-authorised-task",methodRevision=hash("/Users/admin/.agents/skills/central-authorised-task/SKILL.md");
 const first=`${expressionRef}:proposal:first`,entity=`${expressionRef}:entity:source`;
 await op({operation:"propose",expression_ref:expressionRef,expected_revision:1,proposal_ref:first,actor:"agent-session/oi-programme-20260906",activity_ref:"activity:caller-reported:walk",continues_proposal_ref:null,summary:"Present the source as an isolated object",changes:[{change:"entity_add",scene_ref:`${expressionRef}:scene:main`,entity_ref:entity,title:"Expression field"},{change:"subject_bind",entity_ref:entity,binding:{subject_ref:sourceRef,native_owner:"central",presentation_role:"thing",sources:[{ref:sourceRef,revision:sourceRevision,availability:"available"}],readings:[],actions:[]}}],method_refs:[{ref:methodRef,revision:methodRevision,availability:"available"}],evidence_refs:[{ref:sourceRef,revision:sourceRevision,availability:"available"}]});await page.getByText("Conversation",{exact:true}).evaluate(button=>button.click());await page.evaluate(ref=>window.dispatchEvent(new CustomEvent("oi:expression-compose",{detail:{expressionRef:ref}})),expressionRef);
 
 await page.waitForFunction(()=>document.querySelector(".expression-editor")?.textContent?.includes("supplied Activity correlation activity:caller-reported:walk (unverified here)"),undefined,{timeout:15000});assert.match(await editor.innerText(),/supplied Activity correlation activity:caller-reported:walk \(unverified here\)/);assert.equal(await page.locator(".agent-layer").getAttribute("data-agent-session-ref"),null);assert.equal(await page.locator(".agent-layer").getAttribute("data-owner-activity-block"),null);
 await editor.getByLabel(`Decision note for ${first}`).fill("Start from relation and movement");await editor.getByRole("button",{name:"Reject and retain note"}).click({force:true});await page.waitForFunction(()=>document.querySelector(".expression-editor")?.textContent?.includes("rejected by human:expression-editor"));
 const second=`${expressionRef}:proposal:continuation`;
 await op({operation:"propose",expression_ref:expressionRef,expected_revision:3,proposal_ref:second,actor:"agent-session/oi-programme-20260906",activity_ref:null,continues_proposal_ref:first,summary:"Continue with the source moving through relation",changes:[{change:"entity_add",scene_ref:`${expressionRef}:scene:main`,entity_ref:entity,title:"Expression field"},{change:"subject_bind",entity_ref:entity,binding:{subject_ref:sourceRef,native_owner:"central",presentation_role:"thing",sources:[{ref:sourceRef,revision:sourceRevision,availability:"available"}],readings:[],actions:[]}},{change:"parameter_set",entity_ref:entity,parameter:"x",value:-80},{change:"parameter_automate",entity_ref:entity,parameter:"x",automation:{min:-80,max:80,rate_hz:0.1,waveform:"triangle"}}],method_refs:[{ref:methodRef,revision:methodRevision,availability:"available"}],evidence_refs:[{ref:sourceRef,revision:sourceRevision,availability:"available"}]});await page.getByText("Conversation",{exact:true}).evaluate(button=>button.click());await page.evaluate(ref=>window.dispatchEvent(new CustomEvent("oi:expression-compose",{detail:{expressionRef:ref}})),expressionRef);
 
 await page.waitForFunction(ref=>document.querySelector(`[data-proposal-ref="${ref}"]`),second,{timeout:15000});await editor.getByLabel(`Decision note for ${second}`).fill("Keep the source, reduce and stop the movement");await editor.getByLabel(`Correction changes for ${second}`).fill(JSON.stringify([{change:"parameter_manual",entity_ref:entity,parameter:"x"},{change:"parameter_set",entity_ref:entity,parameter:"x",value:24}]));await editor.getByRole("button",{name:"Accept with corrections"}).click({force:true});await page.waitForFunction(()=>document.querySelector(".expression-editor")?.textContent?.includes("accepted by human:expression-editor"));
 const inspected=await op({operation:"inspect",expression_ref:expressionRef});assert.equal(inspected.document.entities[entity].parameters.x.value,24);assert.equal(inspected.document.entities[entity].parameters.x.automation,null);assert.equal(inspected.document.refinements[0].decision.state,"rejected");assert.equal(inspected.document.refinements[1].continues_proposal_ref,first);assert.equal(inspected.document.refinements[1].decision.corrections.length,2);assert.deepEqual(errors,[]);
 console.log(`Expression pedagogy browser walk passed: ${expressionRef}; observer absence remained distinct from unverified caller Activity.`);
}finally{await browser?.close();stop();}
