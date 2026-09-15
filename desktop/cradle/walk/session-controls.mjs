// C-standing session-controls walk. It reads the owner catalogue before any model
// mutation, chooses Luna/Low only when the resident owner advertises both exact
// values, and never sends a conversation message or terminal input.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const project=process.env.WALK_PROJECT??"O-I";
const conversationTitle=process.env.WALK_CONVERSATION_TITLE??"Factory live walk — Codex";
const agentSession=process.env.WALK_AGENT_SESSION??"agent-session/oi-factory-codex-20260914";
const sessionSpace=process.env.WALK_SESSION_SPACE??"session-space/oi-factory-demo-20260914";
const expectedBinding=process.env.WALK_WORKING_BINDING??"working-surface/oi-factory-demo-20260914-shell";
const expectedSurface=process.env.WALK_WORKING_SURFACE??"surface/terminal/factory/shell";
const expectedMarker=process.env.WALK_NATIVE_TERMINAL_ID??"%5";
const baseUrl=process.env.WALK_URL??"http://localhost:4173";
const artifactDir="walk/artifacts";
mkdirSync(artifactDir,{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.WALK_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1422,height:858}});
const checks=[],errors=[],responses=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
const waitFor=async(predicate,label,timeout=30_000)=>{
  const deadline=Date.now()+timeout;
  while(!await predicate()){
    if(Date.now()>=deadline)throw new Error(label);
    await page.waitForTimeout(80);
  }
};
const modelEvidence=async()=>{
  const details=page.getByRole("region",{name:"Session model",exact:true}).getByText("Model evidence",{exact:true}).locator("..");
  if((await details.getAttribute("open"))===null)await details.locator("summary").click();
  const raw=await details.locator("pre").innerText();
  return JSON.parse(raw);
};
const exactSessionReading=(reading)=>{
  check(reading?.agent_session===agentSession,"Owner model reading retains the exact AgentSession");
  check(typeof reading?.native_session_id==="string"&&reading.native_session_id.length>0,"Owner model reading discloses a native session identity");
  return reading.model_observation;
};

page.on("pageerror",error=>errors.push(String(error)));
page.on("response",async response=>{
  if(!response.url().endsWith("/op"))return;
  try{responses.push({request:response.request().postDataJSON(),result:await response.json()});}catch{}
});
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});

let receipt={standing:"C: final-build browser UI + public native owner reads; no model prompt or terminal input",project,conversationTitle,agentSession,sessionSpace,checks,errors,model:null,workingSurface:null};
try {
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:project,exact:true}).click();
  await page.getByRole("button",{name:conversationTitle,exact:true}).click();

  const right=page.locator('[data-region="right"]');
  let planes=right.getByRole("navigation",{name:"Right region planes",exact:true});
  if(await planes.count()===0)await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
  await planes.waitFor();
  await planes.getByRole("button",{name:"Inspect",exact:true}).click();

  const runtime=right.getByRole("region",{name:"Existing session controls",exact:true});
  await runtime.waitFor({timeout:30_000});
  const modelRegion=runtime.getByRole("region",{name:"Session model",exact:true});
  await modelRegion.waitFor({timeout:30_000});

  // This is the owner read whose exact advertised values govern any selection.
  const before=await modelEvidence();
  const observation=exactSessionReading(before);
  check(observation&&Array.isArray(observation.available_models),"Owner discloses an actual resident model catalogue");
  const advertisedModels=observation.available_models;
  const luna=advertisedModels.find(model=>/luna/i.test(String(model.name))||/luna/i.test(String(model.modelId)));
  const effortOptions=observation.reasoning_effort?.options??[];
  const low=effortOptions.find(option=>/^low$/i.test(String(option.name))||/^low$/i.test(String(option.value)));
  const exactNativeSession=before.native_session_id;

  let modelMutation="not-offered";
  if(luna&&low){
    const modelSelect=modelRegion.getByRole("combobox",{name:"Session model",exact:true});
    const effortSelect=modelRegion.getByRole("combobox",{name:"Session reasoning effort",exact:true});
    await modelSelect.selectOption(luna.modelId);
    check(await modelSelect.inputValue()===luna.modelId,"Luna choice comes from the current owner catalogue");
    await effortSelect.selectOption(low.value);
    check(await effortSelect.inputValue()===low.value,"Low effort comes from the current owner catalogue");
    const apply=modelRegion.getByRole("button",{name:"Apply model",exact:true});
    if(await apply.isEnabled()){
      await apply.click();
      await waitFor(async()=>!(await modelRegion.getByRole("button",{name:/Applying/}).count()),"Model selection did not settle");
      modelMutation="applied";
    }else modelMutation="already-selected";
    await modelRegion.getByRole("button",{name:"Refresh model",exact:true}).click();
    await waitFor(async()=>{
      try{return (await modelEvidence())?.native_session_id===exactNativeSession;}catch{return false;}
    },"Refresh did not return an owner model reading");
    const after=await modelEvidence();
    const confirmed=exactSessionReading(after);
    check(after.native_session_id===exactNativeSession,"Selection confirmation remains on the same native session");
    check(confirmed?.current_model_id===luna.modelId,"Owner confirms the exact advertised Luna model");
    check(confirmed?.reasoning_effort?.currentValue===low.value,"Owner confirms the exact advertised Low reasoning effort");
  } else {
    check(true,"Luna Low was not both advertised by the owner; no model mutation was attempted");
  }
  receipt.model={before,advertised:{luna:luna??null,low:low??null},mutation:modelMutation};

  // SessionControls already resolves this once. Refresh repeats the public native read
  // and lets this walk verify the response captured from the bridge.
  await runtime.getByRole("button",{name:"Refresh",exact:true}).click();
  await waitFor(()=>responses.some(row=>row.request?.op==="session_space"&&row.request?.request?.action==="resolve_working"),"No public working-surface resolution reached the native kernel");
  const resolution=responses.findLast(row=>row.request?.op==="session_space"&&row.request?.request?.action==="resolve_working");
  const request=resolution.request.request;
  const data=resolution.result?.outcome?.data;
  check(request.space===sessionSpace&&request.agent_session===agentSession,"Kernel request carries the exact SessionSpace and AgentSession");
  check(data?.binding?.binding===expectedBinding,"Native read confirms the persisted working-surface binding");
  check(data?.binding?.surface===expectedSurface&&data?.binding?.agent_session===agentSession,"Native read confirms the canonical terminal surface and AgentSession");
  const reading=data?.observation?.reading;
  check(reading?.space===sessionSpace&&reading?.binding===expectedBinding&&reading?.surface===expectedSurface,"Provider observation preserves exact persisted surface identity");
  check(reading?.live_native_id===expectedMarker,"Provider observation confirms the existing tmux terminal marker");
  check(reading?.provider_observation?.bindings?.some(binding=>binding.kind==="surface"&&binding.canonical_ref===expectedSurface&&binding.native_id===expectedMarker),"Provider binding maps the marker to the exact canonical terminal surface");
  receipt.workingSurface={request,data};

  await runtime.getByRole("button",{name:"Open working surface",exact:true}).click();
  // Browser preview intentionally cannot attach Tauri/xterm. The button still proves
  // navigation reaches a terminal binding; a native desktop run additionally renders it.
  await page.getByRole("region",{name:"Terminal surface",exact:true}).waitFor({timeout:30_000});
  const terminal=page.getByRole("region",{name:"Terminal surface",exact:true});
  if(await terminal.getByText("Open the desktop app to use its terminal.",{exact:true}).count()){
    check(true,"Browser preview preserves the terminal as a non-attached native-only Surface");
  } else {
    const status=terminal.getByRole("contentinfo",{name:"Terminal status",exact:true});
    check(await status.getByText("Persisted working Surface",{exact:true}).count()===1,"Opened terminal is marked as the persisted working Surface");
    check(await status.getByText("AIKit working Surface",{exact:true}).count()===1,"Opened terminal retains the AIKit attachment classification");
  }
  // Closing the explicit terminal tab must return to the already-open encounter,
  // without sending text or changing the session identity.
  const close=page.getByRole("button",{name:/^Close Working Surface/});
  await close.click();
  await runtime.waitFor({timeout:15_000});
  check(await right.getByText(agentSession,{exact:true}).count()>0,"Closing the terminal returns to the same inspected encounter");
  check(errors.length===0,"No application page errors");
  await page.screenshot({path:artifactDir+"/session-controls.png"});
  receipt.checks=checks;receipt.errors=errors;
  writeFileSync(artifactDir+"/session-controls.json",JSON.stringify(receipt,null,2));
} catch(error) {
  receipt.checks=checks;receipt.errors=errors;receipt.failure=String(error);
  writeFileSync(artifactDir+"/session-controls-failure.json",JSON.stringify(receipt,null,2));
  await page.screenshot({path:artifactDir+"/session-controls-failure.png"});
  console.error("PAGE ERRORS",errors);
  console.error((await page.locator("body").innerText()).slice(-7000));
  throw error;
} finally { await browser.close(); }
