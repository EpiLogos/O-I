import {execFileSync} from "node:child_process";
import {chmodSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";
import {openContextPlane,preparedItem,chooseAccompanying} from "./prepared-helper.mjs";

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
  // The conversation is chosen as the right region's accompanying agent —
  // the companion that hosts prepared context (owner direction 2026-09-19).
  await chooseAccompanying(page,"Context draft acceptance");
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  const source=p.sources[0],content=p.originals.get(source.binding.path);
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  const editor=page.locator('.cm-content[data-source-ref="'+source.binding.ref+'"]');await editor.waitFor();

  const excerpt=content.slice(5,12);
  await selectRange(editor,5,12);
  // No modal: the anchored add action stages the exact selection.
  check(await page.getByRole("dialog",{name:"Include selected context"}).count()===0,"No context-selection modal stands between the selection and context");
  await openContextPlane(page);
  await page.getByRole("button",{name:"Add selection to context",exact:true}).click();
  const item=preparedItem(page,0);await item.waitFor();
  check((await item.locator(".prepared-excerpt").innerText())===excerpt,"The prepared item holds the exact selected source text");
  await item.locator(".prepared-details-toggle").click();
  await item.locator(".prepared-details").waitFor();
  const details=await item.locator(".prepared-details").innerText();
  check(details.includes(source.binding.ref)&&details.includes("Revision")&&((await item.innerText()).includes(`rev ${source.revision.revision.slice(0,10)}`)),"The prepared item discloses its exact source ref and selection-time revision");
  await shot("staged-prepared-item");
  // The quiet cue marks the staged range at the source, presentation only.
  check(await page.locator(".cm-content .context-prepared-cue").count()===1,"A subtle source cue marks the staged range without altering it");

  // The Context plane hosts the material; Include appends through the real
  // native draft owner (AIKit), and the readback returns through the owner.
  await openContextPlane(page);
  const waitDraftGrows=async from=>{
    for(let i=0;i<40;i++){
      const d=p.request("view").draft;
      if(d.text.length>from)return d;
      await page.waitForTimeout(250);
    }
    throw new Error("the owner draft never advanced");
  };
  await item.getByRole("button",{name:"Include in conversation",exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll("[data-prepared-id]")).some(el=>el.textContent.includes("included in")));
  let appended=await waitDraftGrows("Existing owner draft.".length);
  check(appended.text.startsWith("Existing owner draft.\n\n@context — "),"Context include preserves the existing AIKit-owned draft");
  check(appended.text.includes(source.binding.ref)&&appended.text.includes(`revision ${source.revision.revision}`)&&appended.text.endsWith(excerpt.split("\n").map(line=>`> ${line}`).join("\n")),"The owner draft receives the exact quote, source ref and selection-time revision");
  check(p.request("view").blocks.length===0,"Including context does not send a provider prompt or create transcript blocks");

  // Component mode: the picked element stages with structural provenance.
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await editor.locator('.cm-line').first().hover();
  await page.locator('.component-pick-bounds').waitFor();
  await editor.locator('.cm-line').first().click();
  const elementItem=preparedItem(page,1);await elementItem.waitFor();
  await elementItem.locator(".prepared-details-toggle").click();
  await elementItem.locator(".prepared-details").waitFor();
  check((await elementItem.locator(".prepared-details").innerText()).includes("×")&&((await elementItem.innerText()).includes("observed")),"Component mode presents the picked element bounds and structural provenance");
  await elementItem.getByRole("button",{name:"Include in conversation",exact:true}).click();
  appended=await waitDraftGrows(appended.text.length);
  check(appended.text.includes('observed component')&&appended.text.includes('.cm-line')===false,"A real component observation reaches the owner draft with structural provenance");
  await page.getByRole("button",{name:"Writing mode",exact:true}).click();

  // A source that changes after staging is refused at delivery; nothing
  // reaches the draft and the item keeps its error for review.
  await selectRange(editor,5,12);
  await page.getByRole("button",{name:"Add selection to context",exact:true}).click();
  const staleItem=preparedItem(page,2);await staleItem.waitFor();
  await channel("invoke.source_edit",[source.binding.ref,`Changed after selection.\n${content}`]);
  await page.waitForFunction(()=>document.querySelector('.source-editor')?.getAttribute('data-dirty')==='true');
  await staleItem.getByRole("button",{name:"Include in conversation",exact:true}).click();
  await page.waitForTimeout(1500);
  const refusal=staleItem.getByRole("alert");await refusal.waitFor();
  check((await refusal.innerText()).includes("selected material changed"),"A source changed after selection is visibly refused");
  check(p.request("view").draft.revision===appended.revision&&p.request("view").draft.text===appended.text,"Stale refusal leaves the owner draft revision and text unchanged");
  await shot("real-owner-cas-and-stale-refusal");

  // Removing the stale item clears it (and its cue) — presentation only.
  await staleItem.getByRole("button",{name:/Remove .* from context/}).click();
  check(await page.locator("[data-prepared-id]").count()===2,"Removing a prepared item removes exactly that item");

  // Natural selection in rendered material: no mode, no chrome — the
  // reader's own gesture offers the add action at the selection, and the
  // observation reaches the owner draft through the same staged seam.
  await nav.locator('[data-file-path="Work/Editor/context-check.html"]').click();
  const frame=page.frameLocator('iframe.material-frame');await frame.locator('h1').waitFor();
  await frame.locator('h1').click({clickCount:3});
  await frame.getByText('+ Context',{exact:true}).click();
  const pageItem=preparedItem(page,2);await pageItem.waitFor();
  check((await pageItem.locator('.prepared-excerpt').innerText())==='Context acceptance','A plain selection in rendered material stages exactly the selected text');
  await pageItem.getByRole('button',{name:'Include in conversation',exact:true}).click();
  const pageDraft=await waitDraftGrows(appended.text.length);
  check(pageDraft.text.includes('observed text')&&pageDraft.text.includes('viewport bounds x=')&&pageDraft.text.endsWith('> Context acceptance'),'A natural page selection is validated and appended through the real draft owner');
  await frame.locator('h1').click({clickCount:3});
  await frame.getByText('+ Context',{exact:true}).click();
  const stalePage=preparedItem(page,3);await stalePage.waitFor();
  await frame.locator('h1').evaluate(el=>el.textContent='Changed by the page');
  await stalePage.getByRole('button',{name:'Include in conversation',exact:true}).click();
  await stalePage.getByRole('alert').waitFor();
  await page.waitForTimeout(1200);
  check((await stalePage.getByRole('alert').innerText()).includes('component changed'),'Page mutation after selection is refused by live DOM validation');
  check(p.request('view').draft.revision===pageDraft.revision,'A stale page observation does not mutate the owner draft');
  await shot('rendered-natural-selection-stale-refusal');
}
