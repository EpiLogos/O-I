// flow-canvas (U4.1): the flow document carrier, end to end. Re-founded on
// the owner-ratified shape (PROPOSAL-FLOW-DAY-LOGICS-2026-09-13-2, #267): a
// flow is one self-contained 0/1 template instance living in
// `Control/user/flows/`, date and time stamped, accumulated through the day.
// New flow and the fresh tab's Write open writing that MINTS NOTHING — the
// flows directory stays absent and the ground stays clean (a real git repo,
// the collision `oi dev install` actually hit) — and the ground receives the
// writing only at the explicit Save, which mints the instance through
// Central's own file CAS. Appends advance the file revision with the
// document id stable; a canonical AgentSession binds beside the document
// without owning its identity; a dirty composer plus an external write is a
// STRUCTURED conflict — both sides preserved, nothing overwritten; ordinary
// sources still open as ordinary sources; binding, kernel focus and owner
// read co-refer the same path-ref; and no model call occurs anywhere.
import {execFileSync} from "node:child_process";
import {join} from "node:path";
import {readdirSync, readFileSync, existsSync} from "node:fs";
import {setup as sourceSetup} from "./editor.mjs";
import {openChrome} from "../editor-doc.mjs";

export async function setup(args){
  // macOS /var is a symlink: seed the ground under its canonical path so the
  // location refs the desktop builds match the owner's canonical root.
  process.env.TMPDIR="/private/tmp";
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
  // A real worktree baseline over the WHOLE walk ground, so the walk can
  // prove where writing does and does not land: opened writing adds nothing;
  // an explicit Save adds exactly the instance file.
  const git=(...args)=>execFileSync("git",args,{cwd:source.root,encoding:"utf8"});
  git("init","-q");
  git("add","-A");
  git("-c","user.name=walk","-c","user.email=walk@oi.local","commit","-qm","walk baseline");
  const statusLines=()=>git("status","--porcelain")
    .split("\n")
    .map(l=>l.trim())
    .filter(l=>l)
    // Owner runtime state moves during any session (mutation/return locks,
    // horizon revision, aikit's sqlite lock) — it is not writing, and it
    // moves on the owner's real checkout too.
    .filter(l=>!l.includes(".central/")&&!l.includes(".aikit-home/"));
  const gitClean=()=>{const out=statusLines();if(out.length)console.error("WORKTREE DIRTY:",JSON.stringify(out));return out.length===0;};
  if(!gitClean())throw new Error("flow-canvas walk ground did not start clean");
  const flowsDir=()=>join(source.root,"Control/user/flows");
  const flowFiles=()=>existsSync(flowsDir())?readdirSync(flowsDir()).filter(f=>f.endsWith(".html")):[];
  const readInstance=()=>{
    const files=flowFiles();
    if(files.length!==1)throw new Error(`expected exactly one flow instance, got ${JSON.stringify(files)}`);
    const raw=readFileSync(join(flowsDir(),files[0]),"utf8");
    const doc=JSON.parse(raw.match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)[1].replace(/<\\\/script/gi,"</script"));
    return {name:files[0],raw,doc};
  };
  const fileLocation=name=>({"schema":"central.path-ref/v1","ref":`central:path:${source.root}:Control/user/flows/${name}`,"root":source.root,"path":`Control/user/flows/${name}`});
  return {...source,env,native,space,attach,gitClean,statusLines,flowFiles,readInstance,fileLocation};
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}){
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();

  // 1 — the user-section flows list is wired to the ground: an absent flows
  // directory renders honest absence, and both the fresh tab's Write and the
  // navigator's New flow open writing that MINTS NOTHING.
  const flowsList=nav.locator("[data-user-flows]");
  await flowsList.waitFor({timeout:20000});
  check(await flowsList.locator("[data-flows-absent]").count()===1,"An absent flows directory renders honest absence rather than inventing a register");
  await page.keyboard.press("Meta+t");
  // The fresh tab's writing choice is labelled "Start writing" (same word as
  // the rest page's entry; it opens the same mint-nothing draft).
  await page.getByRole("button",{name:"Start writing",exact:true}).waitFor({timeout:20000});
  await page.getByRole("button",{name:"Start writing",exact:true}).click();
  await page.locator(".draft-surface .cm-content").waitFor({timeout:20000});
  check(p.flowFiles().length===0,"The fresh tab's Write mints nothing — no flow file exists");
  check(p.gitClean(),"The fresh tab's Write adds nothing to the ground");
  await page.keyboard.press("Meta+w");
  await nav.locator("[data-user-flows]").getByRole("button",{name:"New flow",exact:true}).click();
  const draftEditor=page.locator(".draft-surface .cm-content");
  await draftEditor.waitFor({timeout:20000});
  check(p.gitClean(),"New flow mints nothing: the ground is untouched");
  check(p.flowFiles().length===0,"New flow creates no flow file");
  // An empty draft cannot reach the ground even through the keyboard path.
  await draftEditor.press("Meta+s");
  await page.waitForTimeout(400);
  check(p.flowFiles().length===0,"An empty draft is not placed — Save refuses to mint a blank");
  await draftEditor.click();
  await page.keyboard.type("The flow canvas keeps the thread alive.\n");
  check(p.gitClean(),"Typed writing is still only on this device — the ground is untouched");
  await openChrome(page,".draft-surface");
  await page.getByRole("button",{name:"Save · ⌘S",exact:true}).click();
  await page.waitForTimeout(3000);
  console.error("DRAFT ERRORS:",await page.evaluate(()=>[...document.querySelectorAll(".flow-error")].map(e=>e.textContent)));
  await page.locator(".flow-surface:not(.draft-surface) .cm-content").waitFor({timeout:20000});
  const composer=page.locator(".flow-surface .cm-content");
  const layout=async()=>(await channel("read.layout")).data.layout;
  const owned=p.readInstance();
  check(!!owned.doc.meta.documentId&&!!owned.doc.meta.created,"The explicit Save mints the instance with its own identity");
  check(owned.doc.entries.length===1&&owned.doc.entries[0].html.includes("The flow canvas keeps the thread alive."),"The typed writing is the document's first F entry, verbatim");
  check(p.flowFiles().length===1,"Exactly one flow instance file exists where the ratified shape names it");
  const bound=Object.values((await layout()).surfaces??{}).find(surface=>surface.kind==="flow"&&surface.location);
  check(!!bound?.flow?.flowRef&&bound.location.path===`Control/user/flows/${owned.name}`,"The surface binding carries the document location");
  const documentId=owned.doc.meta.documentId;

  // 2 — appending entries advances the central revision with the document id
  // stable, and the human's earlier entries are preserved verbatim.
  const save=async()=>{await composer.click();await composer.press("Meta+s");try{await page.waitForFunction(()=>{const el=document.querySelector(".flow-surface [role=status]");return el?.textContent==="Saved";},null,{timeout:15000});}catch(cause){console.error("PROBE:",await page.evaluate(()=>({cm:[...document.querySelectorAll(".cm-content")].map(el=>el.textContent),status:[...document.querySelectorAll(".flow-surface [role=status]")].map(el=>el.textContent)})));throw cause;}};
  const centralRevision=()=>p.call("central.files.read",{location:p.fileLocation(owned.name)}).revision;
  const revisionBefore=centralRevision();
  await composer.click();
  await page.keyboard.type("Second thought, same thread.");
  await save();
  const revisionAfterFirst=centralRevision();
  await composer.click();
  await page.keyboard.type("Third thought, still the same thread.");
  await save();
  const revisionAfterSecond=centralRevision();
  check(revisionAfterFirst!==revisionBefore&&revisionAfterSecond!==revisionAfterFirst,"Each appended entry advances the central revision");
  const afterSaves=p.readInstance();
  check(afterSaves.doc.meta.documentId===documentId,"The document id remains stable across saves");
  check(afterSaves.doc.entries.length===3&&afterSaves.raw.includes("The flow canvas keeps the thread alive.")&&afterSaves.raw.includes("Second thought, same thread.")&&afterSaves.raw.includes("Third thought, still the same thread."),"The owner holds the exact human writing, every entry preserved");
  await shot("flow-canvas-saved");

  // 3+4 — a canonical AgentSession binds beside the document without owning
  // its identity; a second session replaces it and the document continues
  // unchanged at the same revision.
  const spaceRead=()=>p.native("show",p.space);
  p.attach("agent-session/flow-canvas-one",`Working through ${documentId}`);
  check(JSON.stringify(spaceRead()).includes("agent-session/flow-canvas-one"),"The AgentSession's binding names the document it works through");
  p.attach("agent-session/flow-canvas-two",`Working through ${documentId}`);
  const sessions=spaceRead();
  check(JSON.stringify(sessions).includes("agent-session/flow-canvas-two")&&JSON.stringify(sessions).includes("agent-session/flow-canvas-one"),"A second session attaches to the same document without displacing its identity");
  check(centralRevision()===revisionAfterSecond,"Session churn moved the document nothing — same file, same revision");
  await shot("flow-canvas-sessions-bound");

  // 5 — dirty composer + external write: a STRUCTURED conflict. Both sides
  // preserved; the composer never silently overwrites and is never silently
  // overwritten; the rebase lands the next append on the external bytes.
  await composer.click();
  await page.keyboard.type("My unsaved tail while the world moves.");
  await page.waitForFunction(()=>{const el=document.querySelector(".flow-surface [role=status]");return el?.textContent==="Unsaved entry";},null,{timeout:10000});
  const external=p.readInstance();
  external.doc.entries.push({id:"ext-1",author:"H",at:new Date().toISOString(),html:"<p>The external side moved the document.</p>",replyTo:null,touched:false});
  external.doc.meta.revision+=1;
  const externalHtml=external.raw.replace(/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/,()=>'<script type="application/json" id="ql-doc">'+JSON.stringify(external.doc).replace(/<\/script/gi,"<\\/script").replace(/<!--/g,"<\\!--")+"</script>");
  p.call("central.files.write",{location:p.fileLocation(owned.name),expected_revision:revisionAfterSecond,content:externalHtml,actor:"human:walk",actor_kind:"human"});
  const externalRevision=centralRevision();
  await composer.click();await composer.press("Meta+s");
  await page.locator(".flow-surface .source-conflict").waitFor({timeout:15000});
  check((await composer.innerText()).includes("My unsaved tail while the world moves."),"The human composer is preserved verbatim through the conflict");
  check((await page.locator(".flow-surface .source-conflict").innerText()).includes("nothing was overwritten"),"The conflict names the preservation law");
  await page.getByRole("button",{name:"Rebase on the current document"}).click();
  await page.locator(".flow-surface .source-conflict").waitFor({state:"detached",timeout:15000});
  check((await composer.innerText()).includes("My unsaved tail while the world moves."),"Rebasing keeps the composer on the current document");
  await composer.click();await composer.press("Meta+s");
  await page.waitForFunction(()=>{const el=document.querySelector(".flow-surface [role=status]");return el?.textContent==="Saved";},null,{timeout:15000});
  const finalInstance=p.readInstance();
  check(finalInstance.raw.includes("The external side moved the document.")&&finalInstance.raw.includes("My unsaved tail while the world moves."),"The next append lands on the external bytes — both sides in one document");
  await shot("flow-canvas-conflict-resolved");

  // 14 — ordinary sources are not reclassified: a project file opens as the
  // ordinary source editor, with no Flow identity of any kind.
  // The project mode strip is hover-revealed (owner law, 2026-09-18): hover
  // the row, then choose its files mode.
  await nav.getByRole("button",{name:"Editor",exact:true}).hover();
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${p.sources[0].binding.path}"]`).click();
  await page.waitForFunction(ref => document.querySelector('.source-editor .cm-content')?.getAttribute('data-source-ref') === ref, p.sources[0].binding.ref, { timeout: 15000 });
  check(true,"An ordinary source opens at its own ref in the ordinary source editor");
  // Warm-tree retention keeps off-tab surfaces mounted-concealed inside the
  // pane, so identity is asserted on the PRESENTED surface, not the DOM.
  check(await page.locator('.pane.focused .surface-retained:not([hidden])[data-surface-kind="flow"]').count()===0,"The focused ordinary source carries no Flow surface and no Flow identity");

  // 15 — structured co-reference: the persisted binding, the kernel focus and
  // the owner read all name the same document path-ref without any screen
  // scraping.
  await page.locator(".tab").filter({hasText:owned.name}).first().click();
  await page.locator(".pane.focused .flow-surface").waitFor({timeout:15000});
  const bindingNow=Object.values((await layout()).surfaces??{}).find(surface=>surface.kind==="flow"&&surface.location?.path===`Control/user/flows/${owned.name}`);
  const kernelState=(await channel("read.state")).data;
  const focusRef=kernelState.focus?.subject?.ref;
  const expectedRef=`central:path:${p.root}:Control/user/flows/${owned.name}`;
  const flowSurf=kernelState.surfaces?.[Object.keys(kernelState.surfaces??{}).find(id=>kernelState.surfaces[id]?.kind==="flow")] ?? null;
  check(bindingNow?.location?.ref===expectedRef&&focusRef===expectedRef,"Binding and kernel focus co-refer the same document path-ref",{bindingRef:bindingNow?.location?.ref,focusRef,expectedRef});
  check(p.call("central.files.read",{location:p.fileLocation(owned.name)}).location.ref===expectedRef,"The owner names the same document identity back");
  await shot("flow-cocurrency-reference");

  // 16 — no automatic model call: the scenario provisions no provider and
  // opens no encounter; the owner's own history shows every document revision
  // attributed to a human actor.
  const history=p.call("central.files.history",{location:p.fileLocation(owned.name)});
  check(history.entries.length>0&&history.entries.every(event=>event.actor_kind==="human"),"Every document revision in the owner history is human-attributed — no model call exists in the lifecycle");
}
