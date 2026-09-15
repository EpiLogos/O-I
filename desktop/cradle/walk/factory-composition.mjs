// Drive the real Cradle web bundle against the already-running native walk bridge.
// WALK_CHROMIUM_EXECUTABLE selects an installed browser; omit for Playwright's.
// This records C standing, not Agent/provider/material or human acceptance.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
const browser=await chromium.launch({executablePath:process.env.WALK_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:process.env.WALK_MOTION === "full" ? "no-preference" : "reduce"});
const checks=[], errors=[];page.on("pageerror",e=>errors.push(String(e)));
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log("PASS",label);};
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});
try {
await page.goto(process.env.WALK_URL ?? "http://localhost:4173");
await page.getByRole("button",{name:"Factory development",exact:true}).waitFor();
await page.getByRole("button",{name:"Start writing",exact:true}).click();
await page.locator(".cm-content").waitFor();
await page.locator(".cm-content").fill("Factory continuity acceptance — ordinary writing survives.");
await page.evaluate(()=>{window.originalAgent=document.querySelector(".agent-layer");});
const before=(await page.evaluate(()=>window.__cradle.walk.read.layout())).data.layout;
await page.getByRole("button",{name:"Factory development",exact:true}).click();
await page.locator(".factory-encounter-host .agent-layer").waitFor();
check(await page.evaluate(()=>window.originalAgent===document.querySelector(".agent-layer")),"Same Agent DOM enters centre");
check(await page.getByRole("region",{name:"Factory returned material"}).isVisible(),"Factory returned material is hosted in right region");
await page.getByText("Inspect Factory source",{exact:true}).click();
check(await page.locator("[data-region=right] .factory-development").isVisible(),"Native Factory inspection remains explicitly accessible");
await page.getByText("Inspect Factory source",{exact:true}).click();
check(await page.locator(".agent-layer").count()===1,"Exactly one AgentLayer mounted");
await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
await page.locator(".cm-content").waitFor();
check((await page.locator(".cm-content").innerText()).includes("ordinary writing survives."),"Ordinary writing survives exit");
check(await page.evaluate(()=>window.originalAgent===document.querySelector(".agent-layer")),"Same Agent DOM returns to ordinary shell");
const after=(await page.evaluate(()=>window.__cradle.walk.read.layout())).data.layout;
check(before.rightDepth===after.rightDepth&&before.rightWidth===after.rightWidth&&before.leftWidth===after.leftWidth,"Ordinary geometry unchanged");
for(let i=0;i<3;i++){
 await page.getByRole("button",{name:"Factory development",exact:true}).click();
 await page.locator(".factory-encounter-host .agent-layer").waitFor();
 await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
 await page.locator(".cm-content").waitFor();
}
check(await page.evaluate(()=>window.originalAgent===document.querySelector(".agent-layer")),"Rapid composition switches preserve Agent DOM");
await page.getByRole("button",{name:"Factory development",exact:true}).click();
await page.locator(".factory-encounter-host .agent-layer").waitFor();
if(process.env.WALK_MOTION === "full") await page.locator('canvas[data-oi-stage="engine"]').waitFor({state:"attached"});
await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas[data-oi-stage="engine"]')).every(canvas=>getComputedStyle(canvas).visibility==="hidden"));
check(await page.evaluate(()=>Array.from(document.querySelectorAll('canvas[data-oi-stage="engine"]')).every(canvas=>getComputedStyle(canvas).visibility==="hidden")),"Released Stage leaves no frozen overlay");
await page.screenshot({path:"walk/artifacts/factory-f1-wide.png"});
await page.reload();
await page.locator(".factory-encounter-host .agent-layer").waitFor();
check(await page.locator(".workspace-recovery").count()===0,"Factory binding restores without recovery failure");
await page.setViewportSize({width:600,height:820});
await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
await page.locator(".cm-content").waitFor();
check((await page.locator(".cm-content").innerText()).includes("ordinary writing survives."),"Narrow shell leaves Factory and restores draft");
check(errors.length===0,"No application page errors");
writeFileSync(`walk/artifacts/factory-f1-${process.env.WALK_MOTION ?? "reduced"}.json`,JSON.stringify({standing:"C: running production web bundle with real native kernel; no provider or H claim",motion:process.env.WALK_MOTION ?? "reduced",checks,errors,before,after},null,2));
} catch(error) {
 console.error("PAGE ERRORS",errors);
 console.error((await page.locator("body").innerText()).slice(0,3000));
 await page.screenshot({path:"walk/artifacts/factory-f1-failure.png"});
 throw error;
} finally {await browser.close();}
