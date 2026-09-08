import {execFileSync} from "node:child_process";
import {chmodSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

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
  const space="session-space/context-draft-walk",ref="agent-session/context-draft-walk";
  apply(native("create",space,"--label","Context draft acceptance"));
  for(const intent of [
    {operation:"bind-project-context",binding:native("project-context")},
    {operation:"attach-agent-session",attachment:{agent_session:ref,purpose:"Context draft acceptance",provenance:["Explicit real context acceptance"]}},
  ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));
  native("encounter-configure","--provider-json",JSON.stringify({id:"context-walk-unused",label:"Context walk (unused)",argv:["/usr/bin/true"]}));
  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  const request=(action,fields={})=>{const result=native("encounter","--request-json",JSON.stringify({action,agent_session:ref,...fields}));if(!result.ok)throw new Error(JSON.stringify(result));return result.data;};
  request("draft",{basis:0,text:"Existing owner draft."});
  return {...source,env,native,request,space,ref,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

async function selectRange(editor,start,end) {
  await editor.evaluate((element,[from,to])=>{element.focus();element.setSelectionRange(from,to);element.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:320,clientY:220,button:2}));},[start,end]);
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  const conversation=page.getByRole("button",{name:"Context draft acceptance",exact:true});
  try{await conversation.waitFor({timeout:10000});}catch{throw new Error(`Conversation was not disclosed. Buttons: ${JSON.stringify(await nav.locator("button").allTextContents())}; body: ${(await page.locator("body").innerText()).slice(0,1200)}`);}
  await conversation.click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  const source=p.sources[0],content=p.originals.get(source.binding.path);
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  const editor=page.locator('.source-textarea[data-source-ref="'+source.binding.ref+'"]');await editor.waitFor();

  const excerpt=content.slice(0,Math.min(48,content.indexOf("\n")>0?content.indexOf("\n"):48));
  await selectRange(editor,0,excerpt.length);
  await page.getByRole("menuitem",{name:"Add selection to context",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Include selected context"});await dialog.waitFor();
  check(await dialog.getByRole("combobox",{name:"Context destination"}).locator("option").filter({hasText:"Context draft acceptance"}).count()===1,"An existing real conversation is an explicit context destination");
  check(await dialog.locator("pre").innerText()===excerpt,"The tray presents the exact selected source text");
  await dialog.getByRole("button",{name:"Add to draft",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  const appended=p.request("view").draft;
  check(appended.text.startsWith("Existing owner draft.\n\n@context — "),"Context append preserves the existing AIKit-owned draft");
  check(appended.text.includes(source.binding.ref)&&appended.text.includes(`revision ${source.revision.revision}`)&&appended.text.endsWith(excerpt.split("\n").map(line=>`> ${line}`).join("\n")),"The owner draft receives the exact quote, source ref and selection-time revision");
  check(p.request("view").blocks.length===0,"Adding context does not send a provider prompt or create transcript blocks");

  await selectRange(editor,0,excerpt.length);
  await page.getByRole("menuitem",{name:"Add selection to context",exact:true}).click();await dialog.waitFor();
  await editor.evaluate((element)=>{const value=`Changed after selection.\n${element.value}`;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set;setter.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('.source-editor')?.getAttribute('data-dirty')==='true');
  await dialog.getByRole("button",{name:"Add to draft",exact:true}).click();
  const refusal=dialog.getByRole("alert");await refusal.waitFor();
  check((await refusal.innerText()).includes("selected material changed"),"A source changed after selection is visibly refused");
  check(p.request("view").draft.revision===appended.revision&&p.request("view").draft.text===appended.text,"Stale refusal leaves the owner draft revision and text unchanged");
  await shot("real-owner-cas-and-stale-refusal");
}
