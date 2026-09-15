// Negative-path acceptance against the running app and real Factory owner.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
const browser=await chromium.launch({executablePath:process.env.WALK_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:"reduce"});
const errors=[];page.on("pageerror",e=>errors.push(String(e)));
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});
try {
 await page.goto("http://localhost:4173");
 await page.getByRole("button",{name:"Factory development",exact:true}).click();
 const horizon=page.getByRole("region",{name:"Factory activity horizon"});
 await horizon.getByText("Connect work",{exact:true}).click();
 const input=horizon.getByLabel("Developmental state path",{exact:true});
 await input.fill("/nonexistent/oi-factory-live-walk/state.json");
 await horizon.getByRole("button",{name:"Read activity",exact:true}).click();
 await horizon.getByRole("alert").waitFor();
 const rejection=await horizon.getByRole("alert").innerText();
 assert.match(rejection,/unavailable/i);
 assert.equal(await horizon.locator("[data-execution-ref]").count(),0);
 await page.reload();
 await page.getByRole("region",{name:"Factory activity horizon"}).getByRole("alert").waitFor();
 assert.equal(await page.getByLabel("Developmental state path",{exact:true}).first().inputValue(),"/nonexistent/oi-factory-live-walk/state.json");
 await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
 assert.equal(await page.locator(".shell-activity-host:not([hidden])").count(),0);
 assert.deepEqual(errors,[]);
 writeFileSync("walk/artifacts/factory-f2-unavailable.json",JSON.stringify({standing:"C: real application/native owner rejection; no successful execution correlation claim",rejection,checks:["Native failure shown without fabricated executions","Exact locator persists across reload","Leaving removes activity host","No page errors"]},null,2));
 console.log("PASS Factory native rejection, locator persistence and exit");
} finally {await browser.close();}
