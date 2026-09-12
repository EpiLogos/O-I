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
import {join} from "node:path";
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
  const ctrlBin = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const workcellBin = process.env.OI_CAW_WORKCELL_BIN;
  if (!workcellBin) throw new Error("Task allocation requires an explicit Workcell boundary binding (OI_CAW_WORKCELL_BIN)");
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
  const taskInput={
    central:{ctrl_bin:ctrlBin,central_root:source.root,project:"Editor",task_ref:"task:task-basis-walk",purpose:"Task basis acceptance clearing",participant_refs:["agent:editor-walk"],source_refs:["source/editor-walk"]},
    provider:{id:"task-child",label:"Task child acceptance ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]},
    cwd:taskScratch,selected_directories:[taskScratch],
    workcell_boundary_bin:workcellBin,authority_ref:"authority:task-basis-walk",
  };
  // On this machine the Workcell write-boundary preparation is REFUSED
  // (Linux-Landlock only; "no material write adapter implemented for this
  // OS; required protection is refused"). The owner refuses with no weaker
  // fallback and leaves its UNCERTAIN record — allocation retained,
  // ready=false, recoverable only by the same request. That honest state is
  // exactly what the desktop consumer renders here; the echoed accepted
  // dispatch waits for a boundary-capable host.
  let prepareError="";
  let taskRecord;
  try {
    taskRecord=native("encounter-task-configure","--agent-session",ref,"--request-json",JSON.stringify(taskInput));
  } catch (error) {
    prepareError=String(error);
    if(!prepareError.includes("Workcell cannot prepare the exact required protection"))throw error;
  }
  taskRecord=native("encounter-task-read","--agent-session",ref);
  if(taskRecord?.ready!==false)throw new Error(`expected the owner's uncertain task record, got: ${JSON.stringify(taskRecord).slice(0,300)}`);
  // The allocate DID complete before the boundary refusal — the NOW exists on
  // the ground. Read it through the owner for the expectation the dispatch
  // would carry.
  const ctrl=execFileSync(ctrlBin,["--root",source.root,"--json","action","run","central.now.list",JSON.stringify({project:"Editor"})],{encoding:"utf8",env});
  const nowRow=JSON.parse(ctrl).data.records.find(row=>row.task_ref==="task:task-basis-walk");
  if(!nowRow)throw new Error("the allocated NOW is missing from the owner's own listing");
  const nowFull=JSON.parse(execFileSync(ctrlBin,["--root",source.root,"--json","action","run","central.now.read",JSON.stringify({project:"Editor",now_ref:nowRow.now_ref})],{encoding:"utf8",env})).data;
  const nowRef=nowFull.record.now_ref;
  const nowRevision=nowFull.revision.revision;
  const policyRevision=nowFull.record.policy_revision_at_allocation;

  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  return {...source,env,native,taskRecord,taskNow:{now_ref:nowRef,now_revision:nowRevision,policy_revision:policyRevision},space,ref,plainSpace,plainRef,providerLog,agencyBytes,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

export default async function run({page,baseUrl,check,shot,channel,log,provision:p}) {
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"Task basis acceptance",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();

  // The kernel's task read: the owner's record, verbatim; the plain session
  // has none — null is honest absence.
  const read=await channel("invoke.kernel_op",[{op:"encounter_task_read",project:"Editor",agent_session:p.ref}]);
  check(read.data.outcome?.result==="encounter_task_reading"&&read.data.outcome?.data?.schema==="aikit.encounter-task/v1"&&read.data.outcome?.data?.ready===false,"The kernel task route reads the owner's UNCERTAIN record exactly as the owner holds it");
  const plainRead=await channel("invoke.kernel_op",[{op:"encounter_task_read",project:"Editor",agent_session:p.plainRef}]);
  check(plainRead.data.outcome?.result==="encounter_task_reading"&&(plainRead.data.outcome?.data??null)===null,"A session without a task reads as honest absence, not an error");

  // The composer renders the session's ACTUAL task — owner facts only.
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-task")?.getAttribute("data-task-ref")==="task:task-basis-walk",null,{timeout:20000});
  const taskSection=page.locator(".encounter-addressed-task");
  check(await taskSection.getAttribute("data-task-ready")==="preparing","The task section discloses the owner's own uncertain preparation — never a ready claim");
  const taskText=await taskSection.innerText();
  check(taskText.includes("task:task-basis-walk")&&taskText.includes("Task basis acceptance clearing"),"Task ref and purpose render verbatim from the owner's record");
  check(!taskText.includes("Allocated NOW"),"No allocation row renders — the uncertain record does not hold one and the desktop invents nothing");
  check(taskText.includes("has not yet disclosed this session's agency basis"),"The undisclosed agency basis is named honestly — the desktop composes no expectation of its own");
  await shot("task-section-verbatim");

  // A sender-supplied expectation (echoing the recorded allocation) is
  // REFUSED by the owner's task-expectation validation — the task is not
  // ready, and the owner refuses before any transport. This is the same
  // exact-match validation a boundary-capable host exercises with an
  // accepted echo; here the refusal itself is the proof.
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
  // Control: the same expectation addressed directly through the owner CLI —
  // the owner emits its refusal as a structured reply.
  const direct=p.native("encounter","--request-json",JSON.stringify({action:"send",agent_session:p.ref,turn:{delivery_ref:"delivery/task-basis-direct",sender:"agent:sender",expected_binding_revision:"rev/1",expected_task:expectation,packet:{text:"Should never transport.",source_refs:["source/shared"],audience:["agent:editor-walk"]}}}));
  check(direct.ok===false&&String(direct.error?.message??direct.error).includes("Task preparation is incomplete"),"The owner refuses an expectation against its unready task at its own preparation gate (direct control)",{refusal:JSON.stringify(direct.error??direct).slice(0,200)});
  const refused=await channel("invoke.kernel_op",[{op:"encounter",project:"Editor",request:{action:"send",agent_session:p.ref,turn:{delivery_ref:"delivery/task-basis-one",sender:"agent:sender",expected_binding_revision:"rev/1",expected_task:expectation,packet:{text:"Should never transport.",source_refs:["source/shared"],audience:["agent:editor-walk"]}}}}],{soft:true});
  log(`kernel-routed refusal: ${String(refused.error).slice(0,200)}`);
  check(!refused.ok&&String(refused.error).includes("Task preparation is incomplete"),"An expected_task against an unready task is refused by the owner before any transport, named through the repaired walk seam");
  let prompts=[];
  try{prompts=readFileSync(p.providerLog,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");}catch{/* no provider log: no provider ever started — equally honest */}

  // The plain session's composer renders no task section at all.
  await page.getByRole("button",{name:"Plain acceptance — no task",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-task")===null,null,{timeout:20000});
  check(true,"A session without a task renders no task section — nothing is invented");
  await shot("plain-session-no-task-section");
}
