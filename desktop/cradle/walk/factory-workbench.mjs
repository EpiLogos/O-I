// Corrected #289 product walk: real application and native kernel, no mocked owner.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
const browser=await chromium.launch({executablePath:process.env.WALK_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1422,height:858},reducedMotion:"no-preference"});
const checks=[],errors=[];
page.on("pageerror",error=>errors.push(String(error)));
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log("PASS",name);};
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});
try {
  await page.goto(process.env.WALK_URL??"http://localhost:4173");
  await page.getByRole("button",{name:"O-I",exact:true}).click();
  await page.getByRole("navigation",{name:"O-I work",exact:true}).waitFor();
  await page.getByRole("button",{name:"Start writing",exact:true}).click();
  await page.locator(".cm-content").fill("Corrected Factory workbench — this draft survives.");
  await page.evaluate(()=>{window.originalAgent=document.querySelector(".agent-layer");});
  const before=(await page.evaluate(()=>window.__cradle.walk.read.layout())).data.layout;
  const runs=()=>page.getByRole("navigation",{name:"O-I work",exact:true}).getByRole("button",{name:"Runs / Build",exact:true});
  await runs().click();
  await page.getByRole("region",{name:"Factory Runs and Build"}).waitFor();
  check(await page.locator(".shell-activity-host,.factory-activity,.factory-return-region").count()===0,"No Factory banner, activity strip or Return rail");
  check(await page.evaluate(()=>window.originalAgent===document.querySelector(".agent-layer")),"Factory retains the same accompanying Agent DOM");
  check(await page.locator("[data-region=right] .agent-layer").count()===1,"Conversation stays in the right workbench region");
  check(await page.locator(".agent-head").count()===0,"No redundant Agent heading");
  check(await page.getByRole("button",{name:"Exchange over A2A",exact:true}).count()===0,"No A2A exchange chrome in ordinary conversation");
  await page.locator('canvas[data-oi-stage="engine"]').waitFor({state:"attached"});
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas[data-oi-stage="engine"]')].every(c=>getComputedStyle(c).visibility==="hidden"));
  check(true,"Mounted Stage releases without a frozen overlay");
  await page.getByRole("button",{name:"Close O-I · Runs",exact:true}).click();
  await page.locator(".cm-content").waitFor();
  check((await page.locator(".cm-content").innerText()).includes("this draft survives"),"Closing Runs preserves ordinary writing");
  const after=(await page.evaluate(()=>window.__cradle.walk.read.layout())).data.layout;
  check(before.rightDepth===after.rightDepth&&before.rightWidth===after.rightWidth&&before.leftWidth===after.leftWidth,"Opening Runs does not rewrite shell geometry");
  await runs().click();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("region",{name:"Factory Runs and Build"}).waitFor();
  check(await page.locator(".workspace-recovery").count()===0,"Project Runs binding survives reload");
  await page.screenshot({path:"walk/artifacts/factory-corrected-workbench.png"});
  check(errors.length===0,"No application page errors");
  writeFileSync("walk/artifacts/factory-corrected-workbench.json",JSON.stringify({standing:"C: actual web application with native kernel; not Factory execution or human visual acceptance",checks,before,after,errors},null,2));
} catch(error) {
  console.error(errors);console.error((await page.locator("body").innerText()).slice(0,2500));
  await page.screenshot({path:"walk/artifacts/factory-corrected-failure.png"});throw error;
} finally {await browser.close();}
