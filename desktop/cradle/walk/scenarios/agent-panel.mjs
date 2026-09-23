// agent-panel: the one common accompanying panel (src/agent/AgentLayer.tsx),
// walked against a real resident AIKit encounter and the controlled ACP
// protocol fixture (D/C evidence, never model proof):
//   - the tabs are the mode's curation (10-SIDEBARS §4.2): Base Chat · Activity
//     · Agents · Context, Factory Run · Agents · Context;
//   - choosing happens through the unbound composer's own chooser — the
//     existing start/read pair binds the real session into the panel;
//   - a selection is SELECTED in the composer and CARRIED in the recorded
//     message, never both;
//   - Activity is the tape over the owner journal: rows collapsed by default,
//     expanding into their exact detail, raw only behind Show raw;
//   - Inspect opens the object's own page (§4.7, ruling D1), and the
//     `oi:panel-inspect` hand-off lands on a page, deduped by identity;
//   - two presenters of one session (the panel and a centre tab) share ONE
//     observer and ONE draft (P14: one composer), and a mode change remounts
//     neither.
import {execFileSync} from "node:child_process";
import {chmodSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as sourceSetup} from "./editor.mjs";
import {restoreScope} from "../lane2-support.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","activity-provider.py");
const PROJECT="Editor";
const REF="agent-session/agent-panel-walk", OTHER_REF="agent-session/agent-panel-other";
const TITLE="Agent panel acceptance", OTHER_TITLE="Agent panel second conversation";

export async function setup(args) {
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const suite=process.env.OI_BIN??"oi",router=join(source.root,"oi-owner-router.mjs");
  writeFileSync(router,`#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`);chmodSync(router,0o755);
  const env = {...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_BIN:router,OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace};
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bind = JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply","--preview-json",JSON.stringify(preview));
  for(const [space,ref,purpose] of [["session-space/agent-panel-walk",REF,TITLE],["session-space/agent-panel-other",OTHER_REF,OTHER_TITLE]]) {
    apply(native("create",space,"--label",purpose));
    for(const intent of [
      {operation:"bind-project-context",binding:native("project-context")},
      {operation:"attach-agent-session",attachment:{agent_session:ref,purpose,provenance:["Explicit real agent-panel acceptance"]}},
    ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));
  }
  const providerLog=join(source.root,"agent-panel-provider.log");
  native("encounter-configure","--provider-json",JSON.stringify({id:"agent-panel-acp",label:"Agent panel ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]}));
  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  const request=(action,fields={})=>{const result=native("encounter","--request-json",JSON.stringify({action,agent_session:REF,...fields}));if(!result.ok)throw new Error(JSON.stringify(result));return result.data;};
  return {...source,env,native,request,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{} source.cleanup();}};
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  // Every kernel op this window issues, as data: the single-observer law is
  // also counted at the wire, not only read from the in-app census.
  const views=[];
  page.on("request",request=>{
    if(!request.url().endsWith("/op")||request.method()!=="POST")return;
    try{const op=request.postDataJSON();if(op?.op==="encounter"&&op.request?.action==="view"&&op.request?.agent_session===REF)views.push(Date.now());}catch{/* not a JSON op */}
  });
  await page.goto(baseUrl);await channel("info");
  await page.waitForTimeout(600);
  // The scope is chosen in one place (10-SIDEBARS §3.6); the walk stands in
  // the Editor scope the way a restart restores it.
  await restoreScope(page,PROJECT);
  const nav=page.getByRole("complementary",{name:"World navigator"});
  // A project row is a disclosure, not a register choice; the register
  // follows the work actually opened (owner ruling 2026-09-18). So: disclose
  // the project, open its conversation in the centre — the workspace register
  // then names the project and the panel's composer chooser can list it.
  const projectRow=nav.locator(`[data-project-path="Work/${PROJECT}"]`);
  await projectRow.waitFor({timeout:30000});
  await projectRow.click();
  await nav.getByRole("button",{name:TITLE,exact:true}).waitFor({timeout:30000});
  await nav.getByRole("button",{name:TITLE,exact:true}).click();
  await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
  const panel=page.getByRole("region",{name:"Accompanying agent"});
  await panel.waitFor();
  await page.waitForTimeout(400);
  // The row names the planes that fit at the panel's width; the rest are one
  // "More" menu away (the plane-nav overflow law). Reading a mode's planes
  // means reading the row AND the menu; choosing a plane opens the menu when
  // the row doesn't name it.
  const planesRow=()=>panel.getByRole("navigation",{name:"Right region planes"});
  const planes=async()=>{
    const row=(await planesRow().locator(".panel-tab > span:first-child").allInnerTexts()).map(text=>text.trim()).filter(Boolean);
    const more=planesRow().getByRole("button",{name:/More views \(/});
    if(!await more.isVisible().catch(()=>false))return row;
    await more.click();
    const rest=await panel.getByRole("group",{name:"More views"}).getByRole("button").allInnerTexts();
    await page.keyboard.press("Escape");
    return [...row,...rest];
  };
  const plane=async name=>{
    const rowButton=planesRow().getByRole("button",{name,exact:true});
    if(await rowButton.isVisible().catch(()=>false)){await rowButton.click();return;}
    await planesRow().getByRole("button",{name:/More views \(/}).click();
    await panel.getByRole("group",{name:"More views"}).getByRole("button",{name,exact:true}).click();
  };
  // The right region opens with a width transition; the plane nav's overflow
  // measurement can read a momentarily narrow container mid-transition. Wait
  // for the settled, full-width reading before asserting on it.
  await planesRow().waitFor({timeout:10000});
  await page.waitForTimeout(400);

  // --- planes are curated by the mode contract ------------------------------
  check(await panel.getAttribute("data-mode")==="base","The panel names the workspace mode it is curated for");
  const basePlanes=await planes();
  check(JSON.stringify(basePlanes)===JSON.stringify(["Chat","Activity","Agents","Context"]),"Base offers exactly the mode contract's tabs, in its order",basePlanes);
  check((await panel.locator(".avatar-menu-open").getAttribute("aria-label")).startsWith("Agent"),"The avatar carries the mode's curated agent name");
  check(await panel.locator('.chat-composer[data-connection="drafting"]').count()===1,"With no conversation bound the composer says so — it drafts, it invents no session");
  // --- choose: the existing start/read pair binds the real session ------------
  // The panel's fresh card carries the project's real attached conversations
  // (the same start/read pair the centre head uses). The row is activated by
  // keyboard (focus + Enter): a real activation path through the chooser.
  const chooserRows=panel.locator(".chat-history-rows");
  const openChooser=async()=>{
    if(await chooserRows.isVisible().catch(()=>false))return;
    await panel.getByRole("button",{name:"History",exact:true}).click();
    await chooserRows.waitFor({timeout:10000});
  };
  await openChooser();
  await shot("panel-base-no-session");
  const titleRow=chooserRows.getByRole("button",{name:TITLE,exact:true});
  await titleRow.waitFor({timeout:30000});
  await titleRow.focus();
  await titleRow.press("Enter");
  const message=panel.getByRole("textbox",{name:"Message",exact:true});
  await message.waitFor({timeout:30000});
  await page.waitForFunction(ref=>document.querySelector(".agent-layer")?.getAttribute("data-agent-session-ref")===ref,REF,{timeout:30000});
  // The left row opened this conversation in the centre too (today's
  // routing), so the panel reads "Open in the centre — Bring back" (P14):
  // bring it back to walk the panel's own conversation.
  const bringBack=panel.getByRole("button",{name:"Bring back",exact:true});
  if(await bringBack.isVisible().catch(()=>false)||await bringBack.waitFor({timeout:3000}).then(()=>true).catch(()=>false)){await bringBack.click();await message.waitFor({timeout:15000});}
  check(await panel.locator('.chat-composer[data-connection="disconnected"]').count()===1,"The composer shows the owner's connection state before any provider is attached");
  await panel.locator('[data-state="empty-transcript"]').waitFor({timeout:15000});
  check(true,"An empty conversation is a named state with its next action, not a blank pane");
  await panel.locator('.chat-provider[data-provider="agent-panel-acp"]').click();
  await page.waitForFunction(()=>!document.querySelector('.agent-layer .chat-connect[data-fact="disconnected"]'),null,{timeout:60000});
  await page.waitForFunction(()=>document.querySelector(".agent-layer .chat-composer")?.getAttribute("data-connection")==="connected",null,{timeout:30000});
  check(true,"Connecting through the conversation updates the composer's live state from the owner");

  // --- composer chips: harness named, model only what the owner advertises ---
  // The composer grammar (dossier §3.4): harness/model picker chips live on
  // the composer. The harness chip names the real connected harness; the
  // model chip renders only the owner's own model observation — the
  // controlled provider never advertises one, so no model chip may exist.
  const harnessChip=panel.locator('.chat-composer-chips [data-chip="harness"]');
  await harnessChip.waitFor({timeout:15000});
  const harnessName=(await harnessChip.innerText()).trim();
  check(harnessName.length>0&&!harnessName.includes("Agent panel ACP"),
    "The composer's harness chip names the harness from its launch, never the connection's label (A1)",harnessName);
  check(await panel.locator('.chat-composer-chips [data-chip="model"]').count()===0,
    "No model chip is invented when the owner advertises no model observation");

  // --- Status → Preview: the collapsed frame carries the owner's real state --
  // The gradient (dossier §3.3): with the panel collapsed the frame shows a
  // presence dot and a state line derived ONLY from observed encounter facts;
  // the chip's one action is opening the pinned panel, which stands the chip
  // down. Asserted across two distinct owner states: disconnected, then the
  // resident state after the connect above.
  const presenceChip=()=>page.locator(".shell-agent-presence");
  await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
  await presenceChip().waitFor({timeout:15000});
  check(await presenceChip().getAttribute("data-presence-state")==="idle",
    "Collapsed frame: the status chip reads the owner's real resident state (idle) — no invented activity");
  await presenceChip().click();
  await panel.waitFor({timeout:15000});
  check(await page.locator(".shell-agent-presence").count()===0 && await panel.isVisible(),
    "The chip hands over to the pinned panel (Preview) and stands down");
  await panel.locator('.chat-composer[data-connection="connected"]').waitFor({timeout:15000});

  // --- Context: SELECTED is not CARRIED ---------------------------------------
  const contextBlock="@context — Walk source · source/agent-panel-walk · revision rev-walk-1\n> quoted walk line";
  await message.fill(`${contextBlock}\n\nACTIVITY_THINK_TOOL`);
  // The composer's status line carries a standing hint when settled — the
  // draft is settled when it no longer reads Updating/Saving.
  const composerSettled=()=>page.waitForFunction(()=>{
    return [...document.querySelectorAll(".chat-composer-status")].every(el=>{
      const text=el.textContent??"";
      return !text.startsWith("Updating")&&!text.startsWith("Saving");
    });
  },null,{timeout:20000});
  await composerSettled();
  check(p.request("view").draft.text.startsWith(contextBlock),"The selection sits in the AIKit-owned shared draft");
  check(await panel.locator('.chat-composer .chat-attachments .oi-chip').count()===1,"The composer names the attached selection as selected — not sent");
  await shot("panel-context-selected");

  await panel.locator(".chat-send").click();
  await page.waitForFunction(()=>document.querySelector(".agent-layer .agent-chat")?.textContent?.includes("FIXTURE_REPLY"),null,{timeout:60000});
  await panel.locator(".chat-turn-user .chat-attachment").first().waitFor({timeout:15000});
  check(await panel.locator('.chat-composer .chat-attachments .oi-chip').count()===0,"After sending, the selection is no longer selected in the composer");
  check((await panel.locator(".chat-turn-user .chat-attachment").first().innerText()).includes("Walk source"),"The recorded user message carries the selection — the owner record that it was sent");
  await shot("panel-context-carried");

  // --- Activity: the tape over the owner journal -----------------------------
  await plane("Activity");
  const toolRow=panel.locator('.tape-row[data-verb="read"]').filter({hasText:"Fixture read"}).first();
  await toolRow.waitFor({timeout:20000});
  const verbs=await panel.locator(".tape-row .tape-verb").allInnerTexts();
  check(verbs.length>0&&verbs.every(verb=>verb.trim().length>0&&!verb.includes("{")),"Tape rows read a verb, never raw JSON",verbs);
  check(await panel.locator('.tape-row[data-open="true"]').count()===0,"Tape rows are collapsed by default — never a log wall");
  check(await toolRow.getAttribute("data-status")==="done","The tool call settles from its own update (joined by toolCallId)");
  await toolRow.locator(".tape-row-line").click();
  check((await toolRow.locator(".tape-kv").innerText()).includes("Fixture read"),"A tape row expands into the call's exact input");
  await shot("panel-activity-tape");

  // --- Inspect opens the object's own page (D1), never a panel tab ------------
  await toolRow.getByRole("button",{name:"Open",exact:true}).click();
  const eventPage=page.locator('.object-page[data-object-kind="tape-event"]');
  await eventPage.locator(".object-fields dt").first().waitFor({timeout:20000});
  check((await eventPage.locator(".object-title").innerText()).includes("Fixture read"),"A tape row's Open shows that event's own page");
  check(await panel.getAttribute("data-plane")==="Activity","The panel keeps its tab: Inspect is never a panel plane");
  const handOff=()=>page.evaluate(()=>window.dispatchEvent(new CustomEvent("oi:panel-inspect",{detail:{kind:"walk-centre-thing",ref:"walk:centre-thing",title:"Walk hand-off",payload:{handed:"from the centre"},source:"agent-panel walk"}})));
  await handOff();
  const handed=page.locator('.object-page[data-object-kind="handed"]');
  await handed.waitFor({timeout:10000});
  await handed.locator("details.object-raw summary").click();
  check((await handed.locator("details.object-raw pre").innerText()).includes("from the centre"),"An oi:panel-inspect hand-off lands on its own page; the material verbatim only behind Show raw");
  await handOff();await page.waitForTimeout(400);
  check(await page.locator(".tab-title",{hasText:"Walk hand-off"}).count()===1,"Handing the same thing again focuses its page — deduped by identity");
  await shot("panel-inspect-handoff");

  // --- one observer, one draft: the panel and a centre tab ---------------------
  if(!(await nav.isVisible().catch(()=>false)))await page.keyboard.press("Meta+b");
  const centreRow=nav.getByRole("button",{name:TITLE,exact:true});
  await centreRow.waitFor({timeout:15000});
  await centreRow.click();
  const centre=page.locator('[data-region="centre"]');
  const centreMessage=centre.getByRole("textbox",{name:"Message",exact:true});
  await centreMessage.waitFor({timeout:30000});
  const census=()=>page.evaluate(key=>globalThis.__cradle?.encounterObservers?.()[key],`${PROJECT}:${REF}`);
  await page.waitForFunction(key=>(globalThis.__cradle?.encounterObservers?.()[key]?.subscribers??0)>=2,`${PROJECT}:${REF}`,{timeout:15000});
  const before=await census();
  check(before.loops===1&&before.subscribers>=2,"Two presenters of one session share exactly one poll loop",before);
  const from=Date.now();await page.waitForTimeout(3200);
  const issued=views.filter(at=>at>=from).length;
  // The census above already proves ONE poll loop for two presenters; the
  // wire bound only refuses a second observer's duplicate reads.
  check(issued<=6,"The wire carries no second observer's duplicate view reads",{issued,window_ms:3200});
  await centreMessage.fill("Shared draft one store");
  await composerSettled();
  await plane("Chat");
  check(await panel.locator('[data-line="promoted"]').count()===1&&await page.locator('textarea[aria-label="Message"]').count()===1,"P14: with the conversation in the centre, the panel says so and the window holds one composer");
  for(let reads=0;reads<20&&p.request("view").draft.text!=="Shared draft one store";reads++)await page.waitForTimeout(250);
  check(p.request("view").draft.text==="Shared draft one store","The one draft is the AIKit-owned draft");

  // --- a mode change remounts neither the observer nor the draft ----------------
  await page.getByRole("radiogroup",{name:"Workspace mode"}).getByRole("radio",{name:"Factory",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector(".agent-layer")?.getAttribute("data-mode")==="factory",null,{timeout:15000});
  // The Factory fold (handoff §4/§9): Run, Agents and Context are the panel's
  // views; the conversation lives in the centre, so no Conversation plane.
  const factoryPlanes=(await planes()).map(name=>name.trim()).filter(Boolean);
  check(!factoryPlanes.includes("Conversation")&&JSON.stringify(factoryPlanes)===JSON.stringify(["Run","Agents","Context"]),"Factory offers no Conversation plane: Run, Agents and Context are the panel's views",factoryPlanes);
  check(await panel.locator(".chat-composer").count()===0,"The panel never holds a second composer in Factory");
  check(!/conversation is in the centre|Situated in/i.test(await panel.innerText()),"No observer sentences in the panel (A3)");
  check(await panel.getAttribute("data-agent-session-ref")===REF,"The session identity rides through the mode change");
  await page.waitForTimeout(1600);
  const after=await census();
  check(after.loops===1&&after.polls>before.polls,"The same observer kept polling through the mode change — it was never remounted",{before,after});
  check(p.request("view").draft.text==="Shared draft one store","The draft rides through the mode change");
  // Factory dedicates the centre to its own stage, so the encounter tab is
  // not presented here — the panel names where the conversation is instead.
  await shot("panel-factory-conversation-in-centre");
  // Factory's dedicated stage closes the left region and its strip; the
  // keyboard mode binding (⌘⌥1 = Base) is the way back from anywhere.
  await page.keyboard.press("Meta+Alt+1");
  await page.waitForFunction(()=>document.querySelector(".agent-layer")?.getAttribute("data-mode")==="base",null,{timeout:15000});
  // Back in Base the centre tab is presented again: the same session, the
  // same AIKit-owned draft.
  await centreMessage.waitFor({timeout:15000});
  check(await centreMessage.inputValue()==="Shared draft one store","The centre tab shows the same draft once Base presents the centre again");
  await plane("Chat");
  await panel.getByRole("button",{name:"Bring back",exact:true}).click();
  await message.waitFor({timeout:15000});
  check(await message.inputValue()==="Shared draft one store","Bring back returns the conversation to the panel with the draft intact");

  // --- full presentation: Run and the visits read as an instrument, not a
  // sidebar stretched wide ---------------------------------------------------
  await plane("Activity");
  // The panel carries no region chrome — the shell owns the region — so full
  // is reached through the real summon path (the Expression compose event),
  // which visits Composition even though it is not a Central tab.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("oi:expression-compose")));
  await page.waitForFunction(()=>document.querySelector(".agent-layer")?.getAttribute("data-full")==="true",null,{timeout:10000});
  // The shell geometry settles the full width over frames; look only once it has.
  await page.waitForFunction(()=>{const el=document.querySelector(".agent-layer");return !!el&&el.getBoundingClientRect().width>window.innerWidth*0.6;},null,{timeout:10000});
  check(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight&&document.documentElement.scrollWidth<=window.innerWidth),"Full presentation: the document does not scroll");
  await shot("panel-full-composition");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>document.querySelector(".agent-layer")?.getAttribute("data-full")==="false",null,{timeout:10000});

  // --- narrow window widths: the panel keeps its own scrolling and never
  // forces the document to scroll or grow a second line of plane nav --------
  await plane("Context");
  for(const width of [1280,1000,760,640]){
    await page.setViewportSize({width,height:820});
    await page.waitForTimeout(250);
    check(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight&&document.documentElement.scrollWidth<=window.innerWidth),`Narrow width ${width}: the document does not scroll`);
    check(await panel.getByRole("navigation",{name:"Right region planes"}).evaluate(el=>el.scrollHeight<=el.clientHeight+2),`Narrow width ${width}: the plane nav stays one row`);
    await shot(`panel-narrow-${width}`);
  }
  await page.setViewportSize({width:1280,height:820});

  // --- dark theme: the panel carries no hard-coded colour ---------------------
  await page.emulateMedia({colorScheme:"dark"});
  await page.evaluate(()=>{try{const key="oi-cradle.visuals.v1";const value=JSON.parse(localStorage.getItem(key)??"{}");localStorage.setItem(key,JSON.stringify({...value,theme:"dark",revision:(value.revision??0)+1}));}catch{/* best-effort */}});
  await page.reload();await channel("info");
  // Layout (including the right region's open state) persists across reload,
  // so only toggle it open when it is not already showing.
  if(await panel.count()===0||!(await panel.isVisible()))await page.getByRole("button",{name:"Toggle right region",exact:true}).click();
  await panel.waitFor();
  // Whether the accompanying binding survived the reload is not the point of
  // this segment (it is real either way): wait for the bound state, and only
  // re-establish the register and re-choose if it truly comes back unbound.
  await Promise.race([
    page.waitForFunction(ref=>document.querySelector(".agent-layer")?.getAttribute("data-agent-session-ref")===ref,REF,{timeout:8000}),
    panel.getByRole("button",{name:"History",exact:true}).waitFor({timeout:8000}),
  ]).catch(()=>{});
  if(await panel.getAttribute("data-agent-session-ref")!==REF){
    if(!(await nav.isVisible().catch(()=>false)))await page.keyboard.press("Meta+b");
    const projectRow=nav.locator(`[data-project-path="Work/${PROJECT}"]`);
    await projectRow.waitFor({timeout:30000});
    // The row's disclosure may persist across reload; only open it when
    // closed — the row is a toggle, never an unconditional open.
    if((await projectRow.getAttribute("aria-expanded"))!=="true")await projectRow.click();
    const reloadRow=nav.getByRole("button",{name:TITLE,exact:true});
    await reloadRow.waitFor({timeout:30000});
    await reloadRow.click();
    await plane("Chat").catch(()=>{});
    await openChooser();
    const row=chooserRows.getByRole("button",{name:TITLE,exact:true});
    await row.focus();
    await row.press("Enter");
  }
  await page.waitForFunction(ref=>document.querySelector(".agent-layer")?.getAttribute("data-agent-session-ref")===ref,REF,{timeout:30000});
  // The resting plane can itself be a restored layout preference; land on
  // Chat explicitly before reading the composer.
  await plane("Chat");
  await message.waitFor({timeout:30000});
  await shot("panel-dark-conversation");
  await plane("Activity");
  await page.waitForTimeout(300);
  await shot("panel-dark-activity");
  await plane("Context");
  await shot("panel-dark-context");
}
