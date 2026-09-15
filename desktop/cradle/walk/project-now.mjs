import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
const browser=await chromium.launch({executablePath:process.env.WALK_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1422,height:858}});
const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});
try {
  const owner=await (await fetch("http://127.0.0.1:4179/op",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"now",project:"O-I",request:{kind:"project-inspect"}})})).json();
  assert.equal(owner.outcome?.result,"now_reading");
  await page.goto("http://localhost:4173",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"O-I",exact:true}).click();
  await page.getByRole("navigation",{name:"O-I work",exact:true}).getByRole("button",{name:"NOW",exact:true}).click();
  const now=page.getByRole("region",{name:"Project NOW and Inbox",exact:true});
  await now.getByRole("region",{name:"Project Inbox",exact:true}).waitFor();
  check(await now.getByRole("alert").count()===0,"NOW and Inbox both reach their native owners");
  const active=now.getByRole("region",{name:"Active work",exact:true});
  check(await active.locator("li").count()===owner.outcome.data.active_items.length,"Active work matches the current native Project reading");
  for(const item of owner.outcome.data.active_items)assert.ok((await active.innerText()).includes(item.subject));
  const days=now.getByRole("region",{name:"DAY records",exact:true});
  check(await days.locator("li").count()===owner.outcome.data.day_records.length,"DAY lists only owner-disclosed dated records");
  if(owner.outcome.data.day_records.length){
    const date=owner.outcome.data.day_records[0].match(/\d{4}-\d{2}-\d{2}/)[0];
    await days.getByRole("button",{name:`DAY ${date}`,exact:true}).click();
    await page.getByRole("button",{name:`Close ${date}.md`,exact:true}).waitFor();
    check(true,"DAY opens its exact native file in an ordinary workbench pane");
  }
  await page.screenshot({path:"walk/artifacts/project-now-owner-walk.png"});
  writeFileSync("walk/artifacts/project-now-owner-walk.json",JSON.stringify({standing:"C: actual application with native kernel and Central readbacks; H not claimed",checks,project_root:owner.outcome.data.project_root,day_records:owner.outcome.data.day_records,active_count:owner.outcome.data.active_items.length},null,2));
}catch(error){console.error((await page.locator("body").innerText()).slice(-4500));await page.screenshot({path:"walk/artifacts/project-now-failure.png"});throw error;}finally{await browser.close();}
