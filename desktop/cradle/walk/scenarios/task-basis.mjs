import {openConversationInCentre} from "../editor-doc.mjs";
// task-basis (queue cell 2): a real Central task is allocated through the
// owner's encounter-task chain (`encounter-task-configure` — real ctrl
// placement + Workcell boundary preparation), the composer renders the
// session's ACTUAL task verbatim, an addressed turn whose expected_task
// echoes the actual record returns through the native loop, and a fabricated
// basis is refused by the owner with its exact words.
//
// Owner provisioning (agency admission, task request, provider) is owner-side
// work through the owner CLIs, exactly as the owner's own caw_task_dispatch
// test seeds it; the browser drive exercises the desktop consumer.
import {execFileSync} from "node:child_process";
import {chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {isAbsolute,join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
import {blake3} from "hash-wasm";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","addressed-provider.py");
const WORKCELL_CONTROL_TOKEN="controlled-task-basis-walk-token";

export async function setup(args) {
  // The task contract compares CWDs exactly: seed the ground under a
  // canonical path so the kernel's project cwd matches the owner's
  // canonicalised task cwd (macOS /var is a symlink).
  process.env.TMPDIR="/private/tmp";
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const actuationBin = process.env.OI_CAW_ACTUATION_BIN;
  if (!actuationBin) throw new Error("Addressed dispatch requires an explicit Actuation owner binding (OI_CAW_ACTUATION_BIN)");
  // The owner's Central placement adapter accepts only an absolute ctrl
  // (ai-kit central_placement.rs: "Expected explicit native binary").
  const ctrlBin = process.env.OI_CENTRAL_CTRL_BIN;
  if (!ctrlBin || !isAbsolute(ctrlBin)) throw new Error("Task allocation requires an explicit absolute Central owner binding (OI_CENTRAL_CTRL_BIN)");
  const workcellBin = process.env.OI_CAW_WORKCELL_BIN;
  if (!workcellBin) throw new Error("Task allocation requires an explicit Workcell boundary binding (OI_CAW_WORKCELL_BIN: the absolute workcell-write-boundary executable, whose `inspect REQUIREMENTS.json POLICY_REVISION` the owner calls)");
  const suite=process.env.OI_BIN??"oi", router=join(source.root,"oi-owner-router.mjs");
  writeFileSync(router,`#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`);chmodSync(router,0o755);
  const env = {...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_BIN:router,OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace,OI_CAW_ACTUATION_BIN:actuationBin,WORKCELL_CONTROL_TOKEN};
  // The task chain reads Central's effective work policy: seed the same
  // policy sources the owner's own task world uses (the caw_task_dispatch
  // shape — material-filesystem enforcement with the full coverage list).
  const relationsPath = join(source.root, "Control/relations/source-relations.json");
  mkdirSync(join(source.root, "Control/relations"), {recursive: true});
  let relations;
  try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
  catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
  const placement = {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], protected: [], enforcement: "material-filesystem", required_coverage: ["file-content", "file-creation", "file-removal", "rename-link", "truncate", "descendant-processes"], lease_seconds: 300};
  const policies = [
    ["placement.json", "work-placement-policy", placement],
    ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Europe/London", day_boundary_minutes: 0, automatic_day_rollover: true}],
  ];
  relations.relations = relations.relations ?? [];
  for (const [name, role, value] of policies) {
    const path = `Control/user/${name}`;
    writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
    const ref = `central:source:control:root:${path}`;
    if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  }
  writeFileSync(relationsPath, JSON.stringify(relations, null, 2));
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bind = JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply","--preview-json",JSON.stringify(preview));
  const space="session-space/task-basis-walk",ref="agent-session/task-basis-walk";
  const plainSpace="session-space/task-basis-plain",plainRef="agent-session/task-basis-plain";
  apply(native("create",space,"--label","Task basis acceptance"));
  apply(native("create",plainSpace,"--label","Plain session without a task"));
  for(const [sp,s] of [[space,ref],[plainSpace,plainRef]]) {
    apply(native("stage","--space",sp,"--intent-json",JSON.stringify({operation:"bind-project-context",binding:native("project-context")})));
    apply(native("stage","--space",sp,"--intent-json",JSON.stringify({operation:"attach-agent-session",attachment:{agent_session:s,purpose:s===ref?"Task basis acceptance":"Plain acceptance — no task",provenance:["Explicit real task-basis acceptance"]}})));
  }

  // Selected-Agency admission — the task variant authorises the task write
  // action, unlike the plain addressed-dispatch determination.
  const agencyRequest={
    schema:"actuation.agency-actualisation/v1",
    request_ref:"actualisation-request:task-basis-walk",
    requester_ref:"human:owner",
    governing_binding:{schema:"actuation.agency/v1",binding_ref:"binding:governing",agent_ref:"agent:governor",agency_ref:"agency:governing",world_ref:"world:personal",scope_ref:"scope:personal",bounds_refs:["bound:personal","bound:task-basis-walk"],authority_refs:["authority:metagency","authority:task-basis-walk"],return_relation_ref:"return-relation:governing"},
    metagency_grant:{schema:"actuation.agency/v1",grant_ref:"grant:task-basis-walk",agency_ref:"agency:governing",world_binding_ref:"binding:governing",authority_ref:"authority:metagency",bounds_refs:["bound:task-basis-walk"],operations:["determine-agency","actualise-agency"]},
    determination:{schema:"actuation.agency/v1",determination_ref:"determination:task-basis-walk",kind:"delegation",determining_agency_ref:"agency:governing",differentiated_agency_ref:"agency:editor-walk",world_binding_ref:"binding:editor-walk",bounds_refs:["bound:task-basis-walk"],authority_refs:["authority:task-basis-walk"],delegated_autonomy:{allowed_action_refs:["action/aikit/encounter-send","action/aikit/encounter-task"],denied_action_refs:["action:source-mutation"],may_determine_within_bounds:true},return_policy:{mode:"required",return_relation_ref:"return-relation:task-basis-walk"}},
    differentiated_binding:{schema:"actuation.agency/v1",binding_ref:"binding:editor-walk",agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",world_ref:"project:editor-walk",scope_ref:"project:editor-walk:scope",determining_agency_ref:"agency:governing",bounds_refs:["bound:task-basis-walk"],authority_refs:["authority:task-basis-walk"],return_relation_ref:"return-relation:task-basis-walk",continuity_ref:"continuity:agent:editor-walk"},
    agent_identity:{standing:"existing",evidence_refs:["evidence/declared-walk-identity"]},
    provenance:{source_refs:["source/task-basis-walk"],context_refs:[]},
  };
  const realRoot=realpathSync(source.root);
  const agencyPath=join(realRoot,"editor-walk-agency.json");
  const agencyBytes=Buffer.from(JSON.stringify(agencyRequest,null,2));
  writeFileSync(agencyPath,agencyBytes);
  const contextPath=join(realRoot,"editor-walk-context.md");
  const contextText="SELECTED_CONTEXT: the owner's scoped material for the task-basis walk.\n";
  writeFileSync(contextPath,contextText);
  const providerLog=join(source.root,"task-provider.log");
  const binding={
    revision:"rev/1",active:true,
    agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",
    world_ref:"project:editor-walk",world_binding_ref:"binding:editor-walk",
    agency_source:{source_ref:"source/editor-walk",revision:"rev/native-1",path:agencyPath,content_digest:"blake3:"+await blake3(agencyBytes)},
    actuation_bin:actuationBin,
    allowed_senders:["human:owner","agent:sender"],
    allowed_packet_sources:["source/shared"],
    context:{sources:[{source:"source/editor-walk-context",revision:"rev/context-1",path:contextPath,content_digest:"blake3:"+await blake3(contextText)}],source_activations:[],projection:null,activation:null},
  };
  native("encounter-agency-configure","--agent-session",ref,"--binding-json",JSON.stringify(binding));
  native("encounter-configure","--provider-json",JSON.stringify({id:"addressed-acp",label:"Addressed acceptance ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]}));

  // Allocate the Central task through the owner's own chain: central.work.policy
  // → central.now.allocate → central.work.validate, then Workcell boundary
  // preparation (`workcell inspect`) and the session's launcher rebind.
  // The task's working directory must not be an ancestor of protected
  // structural objects (ProjectCentral/.central live under the project root,
  // and an ancestor of a protected object cannot receive an ambiguous write
  // approval) — the walk seeds a scratch sibling, exactly the shape the
  // owner's own task world uses.
  const taskScratch=join(realpathSync(source.root),"Work/Editor","task-scratch");
  mkdirSync(taskScratch,{recursive:true});
  // The task child runs inside the Workcell write boundary: its protocol log
  // must sit within the task's own write aperture (the owner's
  // caw_task_dispatch places it in the task cwd the same way).
  const taskProviderLog=join(taskScratch,"task-provider.log");
  const taskInput={
    central:{ctrl_bin:ctrlBin,central_root:source.root,project:"Editor",task_ref:"task:task-basis-walk",purpose:"Task basis acceptance clearing",participant_refs:["agent:editor-walk"],source_refs:["source/editor-walk"]},
    provider:{id:"task-child",label:"Task child acceptance ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",taskProviderLog]},
    cwd:taskScratch,selected_directories:[taskScratch],
    workcell_boundary_bin:workcellBin,authority_ref:"authority:task-basis-walk",
  };
  // The owner prepares the task only on a boundary-capable Workcell host
  // (Linux Landlock; macOS seatbelt since Workcell 6caa0c1). A refusing host
  // leaves the owner's UNCERTAIN record (ready=false) with no weaker
  // fallback — the accepted-echo walk then cannot run there, and says so.
  let prepareError="";
  try {native("encounter-task-configure","--agent-session",ref,"--request-json",JSON.stringify(taskInput));}
  catch (error) {prepareError=String(error);}
  const taskRecord=native("encounter-task-read","--agent-session",ref);
  if(taskRecord?.ready!==true)throw new Error(`the owner did not prepare the task on this host — the task-basis walk needs a boundary-capable Workcell host: ${prepareError.slice(0,300)||JSON.stringify(taskRecord).slice(0,300)}`);
  // The allocation lives on the ground: read it back through Central's own
  // listing, independently of the AIKit record, for the echo the dispatch carries.
  const ctrl=execFileSync(ctrlBin,["--root",source.root,"--json","action","run","central.now.list",JSON.stringify({project:"Editor"})],{encoding:"utf8",env});
  const nowRow=JSON.parse(ctrl).data.records.find(row=>row.task_ref==="task:task-basis-walk");
  if(!nowRow)throw new Error("the allocated NOW is missing from the owner's own listing");
  const nowFull=JSON.parse(execFileSync(ctrlBin,["--root",source.root,"--json","action","run","central.now.read",JSON.stringify({project:"Editor",now_ref:nowRow.now_ref})],{encoding:"utf8",env})).data;
  const nowRef=nowFull.record.now_ref;
  const nowRevision=nowFull.revision.revision;
  const policyRevision=nowFull.record.policy_revision_at_allocation;

  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  // The task-bound session opens only on the owner's prepared launcher at the
  // task's own cwd (the owner refuses any other provider or directory). The
  // kernel's open supplies the Project cwd, so the open is owner-side here,
  // exactly as the owner's own caw_task_dispatch test opens it.
  const launcher=native("encounter","--request-json",JSON.stringify({action:"providers"})).data.find(row=>row.label==="Task child acceptance ACP");
  const opened=native("encounter","--request-json",JSON.stringify({action:"open",space,agent_session:ref,provider:launcher?.id,cwd:taskRecord.request.cwd}));
  if(!opened.ok){try{process.kill(-owner.data.pid,"SIGTERM");}catch{}throw new Error(`the owner did not open the task-bound session on its prepared launcher: ${JSON.stringify(opened.error)}`);}
  return {...source,env,native,taskRecord,taskNow:{now_ref:nowRef,now_revision:nowRevision,policy_revision:policyRevision},space,ref,plainSpace,plainRef,providerLog,taskProviderLog,agencyBytes,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

export default async function run({page,baseUrl,check,shot,channel,log,provision:p}) {
  // Pane-tier retention (Workbench.tsx): every open conversation's body stays
  // mounted, the inactive one concealed — raw selectors read the PRESENTED one.
  const V=".warm-tree-host:not([hidden]) .pane.focused .surface-retained:not([hidden])";
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await openConversationInCentre(page,"Task basis acceptance");
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();

  // The kernel's task read: the owner's record, verbatim; the plain session
  // has none — null is honest absence.
  const read=await channel("invoke.kernel_op",[{op:"encounter_task_read",project:"Editor",agent_session:p.ref}]);
  const held=read.data.outcome?.data;
  check(read.data.outcome?.result==="encounter_task_reading"&&held?.schema==="aikit.encounter-task/v1"&&held?.ready===true&&held?.revision===p.taskRecord.revision,"The kernel task route reads the owner's PREPARED record exactly as the owner holds it");
  check(held?.allocation?.allocation?.now_ref===p.taskNow.now_ref,"The record's allocated NOW is the one Central's own listing holds for the task");
  const plainRead=await channel("invoke.kernel_op",[{op:"encounter_task_read",project:"Editor",agent_session:p.plainRef}]);
  check(plainRead.data.outcome?.result==="encounter_task_reading"&&(plainRead.data.outcome?.data??null)===null,"A session without a task reads as honest absence, not an error");

  // The composer renders the session's ACTUAL task — owner facts only.
  await page.waitForFunction(v=>document.querySelector(`${v} .encounter-addressed-task`)?.getAttribute("data-task-ref")==="task:task-basis-walk",V,{timeout:20000});
  const taskSection=page.locator(`${V} .encounter-addressed-task`);
  check(await taskSection.getAttribute("data-task-ready")==="ready","The task section discloses the owner's own prepared state");
  const taskText=await taskSection.innerText();
  check(taskText.includes("task:task-basis-walk")&&taskText.includes("Task basis acceptance clearing"),"Task ref and purpose render verbatim from the owner's record");
  check(taskText.includes("Allocated NOW")&&taskText.includes(p.taskNow.now_ref)&&taskText.includes(p.taskNow.now_revision),"The allocated NOW renders verbatim from the owner's record — ref and revision");
  check(taskText.includes("has not yet disclosed this session's agency basis"),"The undisclosed agency basis is named honestly — the desktop composes no expectation of its own");
  await shot("task-section-verbatim");

  // The Inspect plane's NOW section is fed from this surface's own records:
  // the task basis names the allocated NOW, read through the owner.
  await page.locator(`${V} .encounter-planes`).getByRole("button",{name:"Inspect",exact:true}).click();
  const inspect=page.locator(`${V} .encounter-inspect`);
  await inspect.waitFor();
  check(await inspect.locator(`li[data-now-ref="${p.taskNow.now_ref}"]`).count()===1,"The task basis's allocated NOW reaches the Inspect plane by its exact ref");
  await inspect.locator(`[data-now-reading][data-now-ref="${p.taskNow.now_ref}"]`).waitFor({timeout:20000});
  check((await inspect.locator("[data-now-reading]").innerText()).includes("Task basis acceptance clearing"),"The NOW is read through the owner and renders the owner's own relations");
  check(await inspect.locator("[data-now-task-uncertain]").count()===0,"No uncertain-preparation state renders for a prepared task");
  await shot("inspect-now-fed-allocated");
  await page.locator(`${V} .encounter-planes`).getByRole("button",{name:"Conversation",exact:true}).click();

  // The session is resident on the owner's prepared task launcher, at the
  // task's own working directory, inside the Workcell write boundary.
  await page.waitForFunction(v=>!document.querySelector(`${v} .encounter-connect`),V,{timeout:60000});
  const status=await channel("invoke.kernel_op",[{op:"encounter",project:"Editor",request:{action:"status",agent_session:p.ref}}]);
  check(status.data.outcome?.data?.state==="Resident","The task-bound session is resident on its prepared launcher");

  // A sender-supplied expectation echoing the actual record is admitted by the
  // owner and the addressed turn returns through the native loop.
  const expectation={
    revision:p.taskRecord.revision,
    task_ref:p.taskRecord.request.central.task_ref,
    now_ref:p.taskNow.now_ref,
    now_revision:p.taskNow.now_revision,
    policy_revision:p.taskNow.policy_revision,
    cwd:p.taskRecord.request.cwd,
    agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",world_binding_ref:"binding:editor-walk",
    source_ref:"source/editor-walk",source_revision:"rev/native-1",
    source_digest:"blake3:"+await blake3(p.agencyBytes),
  };
  const packet={text:"Return the exact token OI_TASK_BASIS_OK. Do not use tools.",source_refs:["source/shared"],audience:["agent:editor-walk"]};
  const send=(delivery_ref,expected_task)=>channel("invoke.kernel_op",[{op:"encounter",project:"Editor",request:{action:"send",agent_session:p.ref,turn:{delivery_ref,sender:"agent:sender",expected_binding_revision:"rev/1",expected_task,packet}}}],{soft:true});
  const prompts=()=>{try{return readFileSync(p.taskProviderLog,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");}catch{return [];}};
  const echoed=await send("delivery/task-basis-echo",expectation);
  check(echoed.ok&&echoed.data.outcome?.data?.delivery?.phase!=="queued","The echoed expectation is admitted by the owner and submitted to the resident task child",{phase:echoed.data?.outcome?.data?.delivery?.phase,error:String(echoed.error??"").slice(0,200)});
  let delivery;
  for(const end=Date.now()+30000;Date.now()<end;await page.waitForTimeout(500)){delivery=(await channel("invoke.kernel_op",[{op:"encounter",project:"Editor",request:{action:"delivery",agent_session:p.ref,delivery_ref:"delivery/task-basis-echo"}}])).data.outcome?.data;if(delivery?.phase==="returned")break;}
  check(delivery?.phase==="returned","The echoed turn returns through the native loop — the owner's durable receipt settles returned");
  check(prompts().length===1&&JSON.stringify(prompts()[0]).includes(packet.text),"The task child received exactly the one addressed packet");
  await page.waitForFunction(v=>document.querySelector(`${v} .encounter-transcript`)?.textContent?.includes("FIXTURE_REPLY"),V,{timeout:30000});
  check(true,"The task child's reply reaches the canonical transcript through the ordinary read path");
  await shot("task-echo-returned");

  // A fabricated basis (a NOW revision the task never held) is refused by the
  // owner before any transport, in its own words — through the kernel seam and
  // directly through the owner CLI as the control.
  const fabricated={...expectation,now_revision:"central.content-fnv1a64/v1:1:0000000000000000"};
  const direct=p.native("encounter","--request-json",JSON.stringify({action:"send",agent_session:p.ref,turn:{delivery_ref:"delivery/task-basis-direct",sender:"agent:sender",expected_binding_revision:"rev/1",expected_task:fabricated,packet}}));
  check(direct.ok===false&&String(direct.error?.message??direct.error).includes("Addressed task expectations differ from the actual task"),"The owner refuses a fabricated task basis at its own expectation gate (direct control)",{refusal:JSON.stringify(direct.error??direct).slice(0,200)});
  const refused=await send("delivery/task-basis-fabricated",fabricated);
  log(`kernel-routed refusal: ${String(refused.error).slice(0,200)}`);
  check(!refused.ok&&String(refused.error).includes("Addressed task expectations differ from the actual task"),"A fabricated expected_task is refused by the owner before any transport, named verbatim through the kernel seam");
  check(prompts().length===1,"The refused turns produce no provider effect");

  // The plain session's composer renders no task section at all.
  await openConversationInCentre(page,"Plain acceptance — no task");
  await page.locator(`${V} .encounter-heading h2`).filter({hasText:/^Plain /}).waitFor({timeout:20000});
  await page.locator(`${V} .encounter-addressed-service[data-service="running"]`).waitFor({timeout:20000});
  check(await page.locator(`${V} .encounter-addressed-task`).count()===0,"A session without a task renders no task section — nothing is invented");
  await shot("plain-session-no-task-section");

  // The plain session's Inspect plane keeps the generic honest empty state —
  // no task basis, no NOW, nothing inferred.
  await page.locator(`${V} .encounter-planes`).getByRole("button",{name:"Inspect",exact:true}).click();
  await page.locator(`${V} .encounter-inspect`).waitFor();
  check(await page.locator(`${V} .encounter-inspect [data-now-relations-empty]`).count()===1,"A session with no task basis keeps the generic honest empty state");
  await shot("plain-session-inspect-empty");
}
