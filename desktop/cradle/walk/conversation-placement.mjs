// C-standing placement walk: actual browser UI and the existing AIKit session.
// It never opens a provider or sends a prompt. The only text is an unsent,
// local Draft sentinel that is cleared before exit.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";

const conversationTitle=process.env.WALK_CONVERSATION_TITLE??"Factory live walk — Codex";
const agentSession=process.env.WALK_AGENT_SESSION??"agent-session/oi-factory-codex-20260914";
const sessionSpace=process.env.WALK_SESSION_SPACE??"session-space/oi-factory-demo-20260914";
const draftText="Conversation placement acceptance — unsent local draft.";
const browser=await chromium.launch({headless:true,executablePath:process.env.WALK_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1422,height:858}});
const checks=[],errors=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS",label);};
page.on("pageerror",error=>errors.push(String(error)));
await page.addInitScript(()=>{window.__OI_KERNEL_BRIDGE__="http://127.0.0.1:4179";sessionStorage.setItem("oi-cradle.welcome.v1","1");});

try {
  await page.goto(process.env.WALK_URL??"http://localhost:4173");
  const centre=page.locator('[data-region="centre"]');
  const right=page.locator('[data-region="right"]');

  await page.getByRole("button",{name:"Start writing",exact:true}).click();
  const draft=centre.locator(".draft-surface .cm-content");
  await draft.waitFor();
  await draft.fill(draftText);
  check((await draft.innerText())===draftText,"Local Draft retains its unsent sentinel before conversation placement");

  await page.getByRole("button",{name:"O-I",exact:true}).click();
  await page.getByRole("button",{name:conversationTitle,exact:true}).click();
  const centralConversation=centre.locator('.encounter').first();
  await centralConversation.locator('.encounter-transcript[aria-label="Transcript"]').waitFor({timeout:30000});
  check(await centralConversation.locator('.encounter-composer textarea[aria-label="Message"]').count()===1,"Actual conversation has one central composer");
  check(await page.locator('.encounter-composer textarea:visible').count()===1,"Only one visible conversation composer is mounted");

  let planes=right.getByRole("navigation",{name:"Right region planes",exact:true});
  if(await planes.count()===0) await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
  await planes.waitFor();
  for(const plane of ["Activity","Context","Inspect"]){
    await planes.getByRole("button",{name:plane,exact:true}).click();
    check(await right.locator('.encounter-composer textarea:visible').count()===0,`${plane} remains complementary and does not duplicate the composer`);
  }
  await right.getByText("Session identity and authority",{exact:true}).click();
  await right.getByText(agentSession,{exact:true}).waitFor({timeout:30000});
  check(await right.getByText(agentSession,{exact:true}).count()>0,"Inspect retains the exact native AgentSession identity");
  check(await right.getByText(sessionSpace,{exact:true}).count()>0,"Inspect retains the exact native SessionSpace identity");

  await planes.getByRole("button",{name:"Conversation",exact:true}).click();
  await draft.waitFor({timeout:15000});
  check((await draft.innerText())===draftText,"Returning Conversation to the side restores the same local Draft text");
  check(await centre.locator('.encounter-composer textarea:visible').count()===0,"Returned side conversation leaves the central Draft as the single central subject");
  check(await right.locator('.encounter-composer textarea:visible').count()===1,"Returned side conversation still has one visible composer");
  planes=right.getByRole("navigation",{name:"Right region planes",exact:true});
  await planes.getByRole("button",{name:"Inspect",exact:true}).click();
  await right.getByText("Session identity and authority",{exact:true}).click();
  check(await right.getByText(agentSession,{exact:true}).count()>0&&await right.getByText(sessionSpace,{exact:true}).count()>0,"Returned conversation keeps its canonical native session identities");

  await page.getByRole("button",{name:"Runs / Build",exact:true}).click();
  await page.getByRole("button",{name:"Leave Factory",exact:true}).waitFor({timeout:30000});
  await page.locator(".composition-actions").getByRole("button",{name:"Conversation",exact:true}).click();
  await centre.getByRole("navigation",{name:"Encounter planes",exact:true}).getByRole("button",{name:"Conversation",exact:true}).click();
  await centre.locator('.encounter .encounter-composer textarea:visible').waitFor({timeout:15000});
  check(await centre.locator('.encounter .encounter-composer textarea:visible').count()===1,"Factory promotes the same conversation centrally on the explicit Conversation command");
  check(await right.locator('[data-pane="group"]').count()===1,"Factory retains the existing complementary result desk in the right region");
  check(await page.locator('.encounter-composer textarea:visible').count()===1,"Factory conversation promotion does not duplicate the composer");

  await page.getByRole("button",{name:"Leave Factory",exact:true}).click();
  await draft.waitFor({timeout:15000});
  check((await draft.innerText())===draftText,"Leaving Factory restores the original local Draft");
  await draft.fill("");
  check(!(await draft.innerText()).includes(draftText),"The local Draft sentinel is cleared before the walk exits");
  check(errors.length===0,"No application page errors");
  await page.screenshot({path:"walk/artifacts/conversation-placement.png"});
  writeFileSync("walk/artifacts/conversation-placement.json",JSON.stringify({standing:"C: actual application placement with existing AIKit session; no provider opened and no prompt sent",conversationTitle,agentSession,sessionSpace,checks,errors},null,2));
} catch(error) {
  console.error("PAGE ERRORS",errors);
  console.error((await page.locator("body").innerText()).slice(0,5000));
  await page.screenshot({path:"walk/artifacts/conversation-placement-failure.png"});
  throw error;
} finally { await browser.close(); }
