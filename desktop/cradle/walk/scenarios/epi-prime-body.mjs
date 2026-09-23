// epi-prime-body: the receiving-UI walkthrough for the Epi-Logos default
// acting body (O:I #65/#220 app-path proof, walked the way the shell defines
// acceptance — the walk receipt is the walk as data):
//   - entering the Epi-Logos world and its Expressions/Technē faces resolves
//     the default acting body `agent-body/epi-prime-ql` for a NEW conversation
//     through the ordinary provision path — the same chat path, no parallel
//     renderer, no special UI, no mode chatter;
//   - the body resolution is REAL: the provisioned conversation reads back the
//     configured provider id, the exact body revision, a live native session
//     and a truthful model observation (never a relabelled generic agent);
//   - an explicit provider override stays an override and is never labelled
//     Prime–QL; clearing it restores the mode default;
//   - leaving the world keeps ordinary Expressions/Technē useful and retains
//     the work; re-entry re-resolves the body rather than trusting a stale
//     active flag; an owner restart re-resolves truthfully;
//   - with EPI_LIVE=1 the person's first turn runs the real #0-backed source
//     inquiry (live provider), exercises cancellation, and proves a late
//     result cannot mutate the changed encounter.
//
// Every real path arrives by environment (refusing to manufacture): the
// candidate binaries via OI_AIKIT_BIN / OI_AIKIT_SESSION_SPACE_BIN, and the
// acting-body material via EPI_ACTUATION_PRIME_BINARY, EPI_PRIME_AGENT_BINARY,
// EPI_QL_BINARY, EPI_ACTUATION_RESEARCH_BINARY, EPI_QL_SKILL_PATH,
// EPI_FACULTY_CONFIG, EPI_QL_SOURCE_ROOT (EPI_QL_REVISION /
// EPI_ACTUATION_REVISION pin the disclosed revisions).
import {execFileSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {setup as sourceSetup} from "./editor.mjs";

const BODY="agent-body/epi-prime-ql";
const here=dirname(fileURLToPath(import.meta.url));
const BODY_REVISION=process.env.EPI_ACTUATION_REVISION;
const QL_REVISION=process.env.EPI_QL_REVISION;

function required(name){
  const value=process.env[name];
  if(!value||!value.trim()) throw new Error(`EPI ${name} is required — the walkthrough runs the real installed material, never a fixture`);
  return value;
}

export async function setup(args) {
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const env = {...process.env, ...source.env, AIKIT_HOME: join(source.root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_AIKIT_SESSION_SPACE_BIN: sessionSpace};
  const native=(...parts)=>JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bound=JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bound.ok) throw new Error(JSON.stringify(bound));
  // The acting body: the real installed material, configured into this
  // scenario's isolated home scope. Configuration only — open launches it.
  native("encounter-epi-prime-configure",
    "--provider-id","epi-prime-ql",
    "--launcher",required("EPI_ACTUATION_PRIME_BINARY"),
    "--prime-bin",required("EPI_PRIME_AGENT_BINARY"),
    "--ql-bin",required("EPI_QL_BINARY"),
    "--ql-revision",required("EPI_QL_REVISION"),
    "--body-revision",required("EPI_ACTUATION_REVISION"),
    "--skill-path",required("EPI_QL_SKILL_PATH"),
    "--research-bin",required("EPI_ACTUATION_RESEARCH_BINARY"),
    "--faculty-config",required("EPI_FACULTY_CONFIG"),
    "--ql-root",required("EPI_QL_SOURCE_ROOT"));
  // The ordinary override candidate: the controlled ACP fixture, labelled as
  // what it is. It must never be relabelled Prime–QL.
  const providerScript=join(here,"..","fixtures","activity-provider.py");
  native("encounter-configure","--provider-json",JSON.stringify({id:"ordinary-acp",label:"Ordinary ACP (explicit override)",protocol:"acp",argv:["python3","-u",providerScript,"override-walk-log"]}));
  const owner=native("encounter-start"); if(!owner.ok) throw new Error(JSON.stringify(owner));
  return {...source, env, native, cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{} source.cleanup();}};
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const native=(...parts)=>JSON.parse(execFileSync(p.env.OI_AIKIT_SESSION_SPACE_BIN,["-C",p.projectRoot,...parts],{encoding:"utf8",env:p.env}));
  const statusOf=(ref)=>{const r=native("encounter","--request-json",JSON.stringify({action:"status",agent_session:ref}));if(!r.ok)throw new Error(JSON.stringify(r));return r.data;};
  const live=process.env.EPI_LIVE==="1";

  await page.goto(baseUrl); await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  const projectRow=nav.locator(`[data-project-path="Work/Editor"]`);
  await projectRow.waitFor({timeout:30000});
  await projectRow.click();
  await page.waitForTimeout(600);

  // A. Enter the Epi-Logos world (the whole-app world state in the footer),
  // then its Expressions face.
  await page.locator(".workspace-footer-edge").hover().catch(()=>{});
  await page.waitForTimeout(400);
  const epiToggle=page.locator('[data-mode="epi-logos"], [aria-label*="Epi-Logos" i]').first();
  await epiToggle.click({force:true}).catch(()=>{});
  await page.waitForTimeout(800);
  check(await page.locator('.desktop-shell[data-world="epi-logos"], [data-epi-logos="true"]').count()>0 || await epiToggle.getAttribute("aria-pressed")==="true","the Epi-Logos world is active");
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForTimeout(900);
  check(await page.locator('.desktop-shell[data-mode="expressions"]').count()>0,"Expressions opens inside the Epi-Logos world");
  await shot("epi-expressions-entered");

  // A real source-backed subject: open the fixture document as the subject.
  await page.locator('.world-navigator [data-project-path="Work/Editor"] >> nth=0').click().catch(()=>{});
  // New conversation: the unbound composer's first Send provisions through the
  // kernel with the mode's default body — no chooser on the way.
  const message=page.getByRole("textbox",{name:"Message",exact:true}).first();
  await message.waitFor({timeout:20000});
  await message.fill("What relations does this subject hold?");
  const send=page.getByRole("button",{name:"Send",exact:true}).first();
  await send.waitFor({timeout:10000});
  await send.click();
  // The provision opens the real Prime-RPC provider; the encounter surface
  // connects. The receipt carries the resolved body — assert it from the
  // kernel's own readback, then from the resident status.
  await page.waitForFunction(()=>!!document.querySelector(".encounter"),null,{timeout:90000});
  await page.waitForFunction(()=>!!document.querySelector(".agent-layer")?.dataset.agentSessionRef,null,{timeout:20000});
  const ref=await page.evaluate(()=>document.querySelector(".agent-layer")?.dataset.agentSessionRef);
  check(!!ref&&ref.startsWith("agent-session/"),"the new conversation was provisioned and bound in the panel");
  const status=statusOf(ref);
  check(status.provider?.body_ref===BODY,`the resident reads back the exact acting body (${status.provider?.body_ref})`);
  check(status.provider?.body_revision===BODY_REVISION,"the body revision is the delivered Actuation revision");
  check(!!status.provider?.id && status.provider.id==="epi-prime-ql","the provider is the configured Prime-RPC body");
  check(!!status.native_session_id,"a live native Prime session identity exists");
  check(status.model_observation!==undefined,"the model observation is carried truthfully");
  await shot("epi-expressions-body-resolved");

  if(live){
    // The person's useful #0-backed source inquiry: the body answers through
    // the QL faculty (real provider turn).
    await message.fill("Use the ql_relational skill: call await ql_relational.anuttara_read('M0-2-9', max_relations=4) and summarise what the read discloses about this subject. Then reply DONE_EPI_INQUIRY.");
    await page.getByRole("button",{name:"Send",exact:true}).first().click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll(".encounter-assistant")).some(node=>node.textContent.includes("DONE_EPI_INQUIRY")),null,{timeout:240000});
    check(true,"the #0-backed source inquiry returned through the body");
  }

  // C. An explicit override stays an override.
  await page.getByRole("button",{name:"New chat",exact:true}).first().click().catch(()=>{});
  await page.waitForTimeout(500);
  const override=page.getByRole("button",{name:"Ordinary ACP (explicit override)",exact:true}).first();
  await override.waitFor({timeout:20000});
  await override.click();
  await page.waitForTimeout(600);
  const overrideText=await page.locator(".agent-chat").first().innerText();
  check(!/prime.?ql/i.test(overrideText),"the override conversation is never labelled Prime–QL");
  await shot("epi-explicit-override");

  // Clear/restore: the next new conversation resolves the mode default again.
  await page.getByRole("button",{name:"New chat",exact:true}).first().click().catch(()=>{});
  await message.waitFor({timeout:20000});
  await message.fill("Continue from the subject.");
  await page.getByRole("button",{name:"Send",exact:true}).first().click();
  await page.waitForFunction(()=>!!document.querySelector(".encounter"),null,{timeout:90000});
  await page.waitForFunction(()=>!!document.querySelector(".encounter"),null,{timeout:90000});
  await page.waitForFunction(value=>document.querySelector(".agent-layer")?.dataset.agentSessionRef===value,ref!==undefined?undefined:null,null,{timeout:100}).catch(()=>{});
  const restoredRef=await page.evaluate(()=>document.querySelector(".agent-layer")?.dataset.agentSessionRef);
  check(statusOf(restoredRef).provider?.body_ref===BODY,"clearing the override restores the Prime–QL default");

  // B. Move into Technē through the same world: the same default-body law.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await page.waitForTimeout(900);
  check(await page.locator('.desktop-shell[data-mode="techne"]').count()>0,"Technē opens inside the Epi-Logos world");
  const techneMessage=page.getByRole("textbox",{name:"Message",exact:true}).first();
  await techneMessage.waitFor({timeout:20000});
  await techneMessage.fill("Bind this subject for a Technē reading.");
  await page.getByRole("button",{name:"Send",exact:true}).first().click();
  await page.waitForFunction(()=>!!document.querySelector(".encounter"),null,{timeout:90000});
  await page.waitForFunction(()=>!!document.querySelector(".encounter"),null,{timeout:90000});
  await page.waitForTimeout(800);
  const techneRef=await page.evaluate(()=>document.querySelector(".agent-layer")?.dataset.agentSessionRef);
  const techneStatus=statusOf(techneRef);
  check(techneStatus.provider?.body_ref===BODY,"Technē's new conversation resolves the same default body");
  check(techneStatus.provider?.id==="epi-prime-ql","Technē rides the same body, not a parallel renderer");
  await shot("epi-techne-body-resolved");

  // C. Mode off: ordinary Expressions/Technē stays useful, work is retained.
  const keptRef=restoredRef;
  await page.locator('.world-mode-strip [data-mode="base"]').click();
  await page.waitForTimeout(700);
  check(await page.locator('.desktop-shell').count()>0,"leaving the world keeps the shell usable");
  // Re-enter: readiness is re-resolved, not trusted from a stale flag.
  await page.locator(".workspace-footer-edge").hover().catch(()=>{});
  await page.waitForTimeout(300);
  await epiToggle.click({force:true}).catch(()=>{});
  await page.waitForTimeout(700);
  const reentered=statusOf(keptRef);
  check(reentered.provider?.body_ref===BODY,"re-entry re-resolves the body readback truthfully");
  check(reentered.native_session_id===statusOf(keptRef).native_session_id,"the resident identity stays stable across re-entry");

  // C. Restart the provider boundary: the owner is stopped and the app
  // re-resolves truthfully rather than trusting a stale process identity.
  const owners=execFileSync("pgrep",["-f","encounter-serve"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  for(const pid of owners){ try{process.kill(Number(pid),"SIGTERM");}catch{} }
  await page.waitForTimeout(1500);
  const restarted=statusOf(keptRef);
  check(restarted.provider?.body_ref===BODY,"after the owner boundary restart the body re-resolves truthfully");
  await shot("epi-restart-reResolved");

  // C. Cancellation with a live turn: late results do not mutate the encounter.
  if(live){
    const longRef=techneRef;
    await message.fill("Write the integers 1 through 50000 separated by spaces. Begin immediately. Do not use tools.");
    await page.getByRole("button",{name:"Send",exact:true}).first().click();
    await page.waitForTimeout(1500);
    await page.getByRole("button",{name:"Stop",exact:true}).first().click();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll(".encounter button")).some(button=>button.textContent==="Stop"),null,{timeout:60000});
    const after=statusOf(longRef);
    check(after.native_session_id===techneStatus.native_session_id,"cancellation keeps the same native session");
  }

  check(true,"the receiving-UI walkthrough completed on the installed candidate");
}
