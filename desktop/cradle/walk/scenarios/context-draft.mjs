import {execFileSync} from "node:child_process";
import {chmodSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

export async function setup(args) {
  const source = await sourceSetup(args);
  writeFileSync(join(source.projectRoot,"context-check.html"),'<html><body><h1>Context acceptance</h1><button>Observed control</button></body></html>');
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
  await editor.focus();await editor.press("Meta+ArrowUp");
  for(let i=0;i<start;i++)await editor.press("ArrowRight");
  for(let i=start;i<end;i++)await editor.press("Shift+ArrowRight");

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
  const editor=page.locator('.cm-content[data-source-ref="'+source.binding.ref+'"]');await editor.waitFor();

  const excerpt=content.slice(5,12);
  await selectRange(editor,5,12);
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await page.getByRole("button",{name:"Attach selection",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Include selected context"});await dialog.waitFor();
  check(await dialog.getByRole("combobox",{name:"Context destination"}).locator("option").filter({hasText:"Context draft acceptance"}).count()===1,"An existing real conversation is an explicit context destination");
  check(await dialog.locator("pre").innerText()===excerpt,"The tray presents the exact selected source text");
  await dialog.getByRole("button",{name:"Add to draft",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  let appended=p.request("view").draft;
  check(appended.text.startsWith("Existing owner draft.\n\n@context — "),"Context append preserves the existing AIKit-owned draft");
  check(appended.text.includes(source.binding.ref)&&appended.text.includes(`revision ${source.revision.revision}`)&&appended.text.endsWith(excerpt.split("\n").map(line=>`> ${line}`).join("\n")),"The owner draft receives the exact quote, source ref and selection-time revision");
  check(p.request("view").blocks.length===0,"Adding context does not send a provider prompt or create transcript blocks");

  await editor.locator('.cm-line').first().hover();
  await page.locator('.component-pick-bounds').waitFor();
  await editor.locator('.cm-line').first().click();await dialog.waitFor();
  check((await dialog.locator('.context-origin').first().innerText()).includes('×'),"Component mode presents the picked element bounds and selector");
  await dialog.getByRole("button",{name:"Add to draft",exact:true}).click();await dialog.waitFor({state:'detached'});
  appended=p.request('view').draft;
  check(appended.text.includes('observed component')&&appended.text.includes('.cm-line')===false,"A real component observation reaches the owner draft with structural provenance");
  await page.getByRole("button",{name:"Writing mode",exact:true}).click();

  await selectRange(editor,5,12);
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await page.getByRole("button",{name:"Attach selection",exact:true}).click();await dialog.waitFor();
  await channel("invoke.source_edit",[source.binding.ref,`Changed after selection.\n${content}`]);
  await page.waitForFunction(()=>document.querySelector('.source-editor')?.getAttribute('data-dirty')==='true');
  await dialog.getByRole("button",{name:"Add to draft",exact:true}).click();
  const refusal=dialog.getByRole("alert");await refusal.waitFor();
  check((await refusal.innerText()).includes("selected material changed"),"A source changed after selection is visibly refused");
  check(p.request("view").draft.revision===appended.revision&&p.request("view").draft.text===appended.text,"Stale refusal leaves the owner draft revision and text unchanged");
  await shot("real-owner-cas-and-stale-refusal");
  await dialog.getByRole('button',{name:'Close context selection'}).click();
  await nav.locator('[data-file-path="Work/Editor/context-check.html"]').click();
  const frame=page.frameLocator('iframe.material-frame');await frame.locator('button').waitFor();
  await page.getByRole('button',{name:'Context mode',exact:true}).click();
  await page.waitForTimeout(400);
  await frame.locator('button').click();await dialog.waitFor();
  await dialog.getByRole('button',{name:'Add to draft',exact:true}).click();await dialog.waitFor({state:'detached'});
  const pageDraft=p.request('view').draft;
  check(pageDraft.text.includes('observed component')&&pageDraft.text.includes('viewport bounds x=')&&pageDraft.text.endsWith('> Observed control'),'A sandboxed page observation is validated and appended through the real draft owner');
  await frame.locator('button').click();await dialog.waitFor();
  await frame.locator('button').evaluate(el=>el.textContent='Changed by the page');
  await dialog.getByRole('button',{name:'Add to draft',exact:true}).click();await dialog.getByRole('alert').waitFor();
  check((await dialog.getByRole('alert').innerText()).includes('component changed'),'Page mutation after picking is refused by live DOM validation');
  check(p.request('view').draft.revision===pageDraft.revision,'A stale page observation does not mutate the owner draft');
  await shot('rendered-component-stale-refusal');

}
