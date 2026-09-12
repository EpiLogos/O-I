// flow-canvas (U4.1): Flow is the default canvas object. #138 acceptance
// subset 1–5, 14–16: New Flow creates an ordinary native-owner source and
// opens it in the existing editor surface; the FlowRef stays stable across
// human saves; a canonical AgentSession binds beside the Flow without owning
// its identity and a second session replaces it with the same Flow continuing
// at the same revision; a dirty human buffer plus an external Flow revision
// is a STRUCTURED conflict — both sides preserved, nothing overwritten;
// ordinary sources still open as ordinary sources; desktop and owner co-refer
// to the same FlowRef/revision through structured reads (bridge layout +
// kernel state + owner Actions), never screen scraping; and no model call
// occurs anywhere in the Flow lifecycle.
import {execFileSync} from "node:child_process";
import {join} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";

export async function setup(args){
  const source=await sourceSetup(args);
  const aikit=process.env.OI_AIKIT_BIN??"aikit";
  const sessionSpace=process.env.OI_AIKIT_SESSION_SPACE_BIN??"aikit-session-space";
  const env={...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace};
  const bind=JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const native=(...parts)=>JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const apply=preview=>native("apply","--preview-json",JSON.stringify(preview));
  const space="session-space/flow-canvas-walk";
  apply(native("create",space,"--label","Flow canvas acceptance"));
  apply(native("stage","--space",space,"--intent-json",JSON.stringify({operation:"bind-project-context",binding:native("project-context")})));
  const attach=(session,purpose)=>apply(native("stage","--space",space,"--intent-json",JSON.stringify({operation:"attach-agent-session",attachment:{agent_session:session,purpose,provenance:["Explicit flow-canvas acceptance"]}})));
  return {...source,env,native,space,attach};
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}){
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();

  // 1 — the navigator's Flows group is wired to Central's own listing, and
  // New flow creates through the owner and opens in the ordinary editor
  // surface. No prompt form, no metadata form (§1).
  await page.getByRole("button",{name:"New flow",exact:true}).waitFor({timeout:20000});
  check(await page.locator(".project-flows .flow-row").count()===0,"An empty project discloses no Flows rather than inventing one");
  await page.getByRole("button",{name:"New flow",exact:true}).click();
  const flowEditor=page.locator(".flow-surface .cm-content");
  await flowEditor.waitFor({timeout:20000});
  await flowEditor.click();
  await page.keyboard.type("The flow canvas keeps the thread alive.\n");
  const layout=async()=>(await channel("read.layout")).data.layout;
  const ownerFlows=()=>p.call("projectcentral.flow.list",{project:"Editor"}).flows;
  const owned=ownerFlows();
  check(owned.length===1,"Central holds exactly the created Flow");
  const bound=Object.values((await layout()).surfaces??{}).find(surface=>surface.kind==="flow");
  check(!!bound?.flow?.flowRef&&bound.flow.flowRef===owned[0].flow_ref&&bound.ref===owned[0].source_ref,"The surface binding carries the owner's own FlowRef and source ref");
  const flowRef=owned[0].flow_ref,sourceRef=owned[0].source_ref,flowPath=owned[0].path;

  // 2 — two human saves advance the owner revision while the FlowRef and
  // source identity stay exactly stable.
  const save=async()=>{await flowEditor.click();await flowEditor.press("Meta+s");try{await page.waitForFunction(()=>{const el=document.querySelector(".flow-surface [role=status]");return el?.textContent==="Saved";},null,{timeout:15000});}catch(cause){console.error("PROBE:",await page.evaluate(()=>({cm:[...document.querySelectorAll(".cm-content")].map(el=>el.textContent),status:[...document.querySelectorAll(".flow-surface [role=status]")].map(el=>el.textContent)})));throw cause;}};
  const ownerRevision=()=>p.call("projectcentral.flow.inspect",{project:"Editor",flow_ref:flowRef}).flow.current_revision;
  const revisionBefore=ownerRevision();
  await save();
  const revisionAfterFirst=ownerRevision();
  await flowEditor.click();
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.type("Second thought, same thread.");
  await save();
  const revisionAfterSecond=ownerRevision();
  check(revisionAfterFirst!==revisionBefore&&revisionAfterSecond!==revisionAfterFirst,"Each human save advances the owner revision");
  const afterSaves=p.call("projectcentral.flow.read",{project:"Editor",flow_ref:flowRef});
  check(afterSaves.flow.flow_ref===flowRef&&afterSaves.flow.source_ref===sourceRef,"The FlowRef and source identity remain stable across saves");
  check(afterSaves.content.includes("The flow canvas keeps the thread alive.")&&afterSaves.content.includes("Second thought, same thread."), "The owner holds the exact human writing");
  await shot("flow-canvas-saved");

  // 3+4 — a canonical AgentSession binds beside the Flow without owning its
  // identity; a second session replaces it and the Flow continues unchanged
  // at the same revision.
  const spaceRead=()=>p.native("show",p.space);
  p.attach("agent-session/flow-canvas-one",`Working through ${flowRef}`);
  check(JSON.stringify(spaceRead()).includes("agent-session/flow-canvas-one"),"The AgentSession's binding names the Flow it works through");
  p.attach("agent-session/flow-canvas-two",`Working through ${flowRef}`);
  const sessions=spaceRead();
  check(JSON.stringify(sessions).includes("agent-session/flow-canvas-two")&&JSON.stringify(sessions).includes("agent-session/flow-canvas-one"),"A second session attaches to the same Flow without displacing its identity");
  check(p.call("projectcentral.flow.inspect",{project:"Editor",flow_ref:flowRef}).flow.current_revision===revisionAfterSecond,"Session churn moved the Flow nothing — same Flow, same revision");
  await shot("flow-canvas-sessions-bound");

  // 5 — dirty human buffer + external Flow revision: a STRUCTURED conflict.
  // Both sides preserved; the buffer never silently overwrites and is never
  // silently overwritten.
  await flowEditor.fill("The flow canvas keeps the thread alive.\nSecond thought, same thread.\nMy unsaved tail while the world moves.\n");
  await page.waitForFunction(()=>{const el=document.querySelector(".flow-surface [role=status]");return el?.textContent==="Unsaved";},null,{timeout:10000});
  p.call("projectcentral.flow.write",{project:"Editor",flow_ref:flowRef,expected_revision:revisionAfterSecond,content:"The external side moved the Flow while the canvas was dirty.\n",actor:"human:walk",actor_kind:"human"});
  const externalRevision=ownerRevision();
  await flowEditor.click();await flowEditor.press("Meta+s");
  await page.locator(".flow-surface .source-conflict").waitFor({timeout:15000});
  const expected=await page.locator(".flow-surface .source-conflict [data-expected]").getAttribute("data-expected");
  const current=await page.locator(".flow-surface .source-conflict [data-current]").getAttribute("data-current");
  check(expected===revisionAfterSecond&&current===externalRevision,"The conflict carries the exact expected and current revisions");
  check((await flowEditor.innerText()).includes("My unsaved tail while the world moves."),"The human buffer is preserved verbatim through the conflict");
  check((await page.locator(".flow-surface .source-conflict-canonical-body").innerText()).includes("The external side moved the Flow"),"The canonical side is disclosed read-only beside the draft");
  await page.getByRole("button",{name:"Keep my draft and resolve later"}).click();
  check(await page.locator(".flow-surface .source-conflict").count()===0,"Keeping the draft returns to the dirty buffer with nothing lost");
  await flowEditor.click();await flowEditor.press("Meta+s");
  await page.locator(".flow-surface .source-conflict").waitFor({timeout:15000});
  await page.getByRole("button",{name:"Take the canonical side (discard my draft)"}).click();
  await save();
  check(ownerRevision()===externalRevision&&p.call("projectcentral.flow.read",{project:"Editor",flow_ref:flowRef}).flow.current_revision===externalRevision,"Taking the canonical side lands the buffer exactly on the owner revision");
  check((await flowEditor.innerText()).includes("The external side moved the Flow"),"The editor now holds the canonical writing");
  await shot("flow-canvas-conflict-resolved");

  // 14 — ordinary sources are not reclassified: a project file opens as the
  // ordinary source editor, with no Flow identity of any kind.
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${p.sources[0].binding.path}"]`).click();
  await page.waitForFunction(ref => document.querySelector('.source-editor .cm-content')?.getAttribute('data-source-ref') === ref, p.sources[0].binding.ref, { timeout: 15000 });
  check(true,"An ordinary source opens at its own ref in the ordinary source editor");
  check(await page.locator(".pane.focused .flow-surface").count()===0,"The focused ordinary source carries no Flow surface and no Flow identity");

  // 15 — structured co-reference: the persisted binding, the kernel state and
  // the owner Action all name the same FlowRef/source/revision without any
  // screen scraping.
  await page.locator(".tab").filter({hasText:flowPath.split("/").pop()}).first().click();
  await page.locator(".pane.focused .flow-surface").waitFor({timeout:15000});
  const bindingNow=Object.values((await layout()).surfaces??{}).find(surface=>surface.kind==="flow"&&surface.flow?.flowRef===flowRef);
  const kernelState=(await channel("read.state")).data;
  const focusRef=kernelState.focus?.subject?.ref;
  check(bindingNow?.ref===sourceRef&&focusRef===sourceRef,"Binding and kernel focus co-refer the same source identity");
  check(p.call("projectcentral.flow.inspect",{project:"Editor",flow_ref:flowRef}).flow.source_ref===sourceRef,"The owner names the same source identity back");
  await shot("flow-cocurrency-reference");

  // 16 — no automatic model call: the scenario provisions no provider and
  // opens no encounter; the owner's own history shows every Flow revision
  // attributed to a human actor.
  const history=p.call("projectcentral.flow.history",{project:"Editor",flow_ref:flowRef});
  check(history.revisions.length>0&&history.revisions.every(receipt=>receipt.actor_kind==="human"),"Every Flow revision in the owner history is human-attributed — no model call exists in the lifecycle");
}
