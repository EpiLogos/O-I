// send-group-reconnect (6B, cut 2): the desktop dispatches one addressed packet
// to a group of explicitly named residents through the pinned ai-kit candidate
// (PR #278 head 3d23d1e) — the owner admits the whole group before the first
// transport effect, every recipient receives an independent durable result with
// its own participation basis, and the fanout is never atomic. After an owner
// restart the desktop reconnects to the actually recorded native session
// identity (never a silent replacement), and the durable delivery receipts
// survive the restart.
//
// Owner provisioning (two agency admissions through real Actuation, two
// controlled providers, one resident owner) is owner-side work exactly as §10
// prescribes; the browser drive exercises the desktop consumer.
import {execFileSync} from "node:child_process";
import {chmodSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
import {blake3} from "hash-wasm";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","addressed-provider.py");
const RECIPIENTS=[
  {id:"a",session:"agent-session/group-walk-a",agent:"agent:group-a",basis:"rev/1",provider:"group-acp-a",label:"Group walk A (a)"},
  {id:"b",session:"agent-session/group-walk-b",agent:"agent:group-b",basis:"rev/2",provider:"group-acp-b",label:"Group walk B (b)"},
];

export async function setup(args) {
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const actuationBin = process.env.OI_CAW_ACTUATION_BIN;
  if (!actuationBin) throw new Error("Group dispatch requires an explicit Actuation owner binding (OI_CAW_ACTUATION_BIN)");
  const suite=process.env.OI_BIN??"oi",router=join(source.root,"oi-owner-router.mjs");
  writeFileSync(router,`#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`);chmodSync(router,0o755);
  const env = {...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_BIN:router,OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace,OI_CAW_ACTUATION_BIN:actuationBin};
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bind = JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply","--preview-json",JSON.stringify(preview));
  const space="session-space/group-walk";
  apply(native("create",space,"--label","Group dispatch acceptance"));
  for(const intent of [
    {operation:"bind-project-context",binding:native("project-context")},
    ...RECIPIENTS.map(recipient=>({operation:"attach-agent-session",attachment:{agent_session:recipient.session,purpose:`Group dispatch acceptance ${recipient.id.toUpperCase()}`,provenance:["Explicit real addressed-group acceptance"]}})),
  ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));

  const realRoot=realpathSync(source.root);
  const providerLogs={};
  let owner={ok:false};
  const startOwner=()=>{owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));return owner;};
  const contextText="SELECTED_CONTEXT: the owner's scoped writing material for the addressed turn.\n";
  for(const recipient of RECIPIENTS) {
    const agencyRequest={
      schema:"actuation.agency-actualisation/v1",
      request_ref:`actualisation-request:group-walk-${recipient.id}`,
      requester_ref:"human:owner",
      governing_binding:{schema:"actuation.agency/v1",binding_ref:"binding:governing",agent_ref:"agent:governor",agency_ref:"agency:governing",world_ref:"world:personal",scope_ref:"scope:personal",bounds_refs:["bound:personal",`bound:group-walk-${recipient.id}`],authority_refs:["authority:metagency",`authority:group-walk-${recipient.id}`],return_relation_ref:"return-relation:governing"},
      metagency_grant:{schema:"actuation.agency/v1",grant_ref:`grant:group-walk-${recipient.id}`,agency_ref:"agency:governing",world_binding_ref:"binding:governing",authority_ref:"authority:metagency",bounds_refs:[`bound:group-walk-${recipient.id}`],operations:["determine-agency","actualise-agency"]},
      determination:{schema:"actuation.agency/v1",determination_ref:`determination:group-walk-${recipient.id}`,kind:"delegation",determining_agency_ref:"agency:governing",differentiated_agency_ref:`agency:group-${recipient.id}`,world_binding_ref:`binding:group-${recipient.id}`,bounds_refs:[`bound:group-walk-${recipient.id}`],authority_refs:[`authority:group-walk-${recipient.id}`],delegated_autonomy:{allowed_action_refs:["action/aikit/encounter-send"],denied_action_refs:["action:source-mutation"],may_determine_within_bounds:true},return_policy:{mode:"required",return_relation_ref:`return-relation:group-walk-${recipient.id}`}},
      differentiated_binding:{schema:"actuation.agency/v1",binding_ref:`binding:group-${recipient.id}`,agent_ref:recipient.agent,agency_ref:`agency:group-${recipient.id}`,world_ref:"central:project:editor-walk",scope_ref:"central:project:editor-walk:scope",determining_agency_ref:"agency:governing",bounds_refs:[`bound:group-walk-${recipient.id}`],authority_refs:[`authority:group-walk-${recipient.id}`],return_relation_ref:`return-relation:group-walk-${recipient.id}`,continuity_ref:`continuity:agent:group-${recipient.id}`},
      agent_identity:{standing:"existing",evidence_refs:["evidence/declared-walk-identity"]},
      provenance:{source_refs:[`source/group-walk-${recipient.id}`],context_refs:[]},
    };
    const agencyPath=join(realRoot,`group-walk-agency-${recipient.id}.json`);
    const agencyBytes=Buffer.from(JSON.stringify(agencyRequest,null,2));
    writeFileSync(agencyPath,agencyBytes);
    const contextPath=join(realRoot,`group-walk-context-${recipient.id}.md`);
    writeFileSync(contextPath,contextText);
    providerLogs[recipient.id]=join(source.root,`group-provider-${recipient.id}.log`);
    const binding={
      revision:recipient.basis,active:true,
      agent_ref:recipient.agent,agency_ref:`agency:group-${recipient.id}`,
      world_ref:"central:project:editor-walk",world_binding_ref:`binding:group-${recipient.id}`,
      agency_source:{source_ref:`source/group-walk-${recipient.id}`,revision:"rev/native-1",path:agencyPath,content_digest:"blake3:"+await blake3(agencyBytes)},
      actuation_bin:actuationBin,
      allowed_senders:["human:owner","agent:sender"],
      allowed_packet_sources:["source/shared"],
      context:{sources:[{source:`source/group-walk-context-${recipient.id}`,revision:"rev/context-1",path:contextPath,content_digest:"blake3:"+await blake3(contextText)}],source_activations:[],projection:null,activation:null},
    };
    native("encounter-agency-configure","--agent-session",recipient.session,"--binding-json",JSON.stringify(binding));
    native("encounter-configure","--provider-json",JSON.stringify({id:recipient.provider,label:recipient.label,protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLogs[recipient.id]]}));
  }
  startOwner();
  const request=(session,action,fields={})=>{const result=native("encounter","--request-json",JSON.stringify({action,agent_session:session,...fields}));if(!result.ok)throw new Error(JSON.stringify(result));return result.data;};
  const restartOwner=()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}/* the canonical socket rebinds on the next start */execFileSync("sleep",["1"]);return startOwner();};
  return {...source,env,native,request,restartOwner,space,providerLogs,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

const providerPrompts=log=>readFileSync(log,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");
const providerRequests=(log,method)=>readFileSync(log,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method===method);

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  const [a,b]=RECIPIENTS;
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"Group dispatch acceptance A",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  await page.getByRole("button",{name:"Group walk A (a)",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-service")?.getAttribute("data-service")==="running",null,{timeout:30000});
  // Both recipients need a live resident native session before a group can be
  // admitted — an unopened participant refuses the whole group owner-side.
  await nav.getByRole("button",{name:"Group dispatch acceptance B",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  await page.getByRole("button",{name:"Group walk B (b)",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});
  await page.locator(".tab").filter({hasText:"Group dispatch acceptance A"}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  check(true,"Both participants are connected with the native dispatch service disclosed");

  // Group composition: explicit per-recipient bases, explicit audience; the
  // shared packet fields are the same card's sender/source-refs/text.
  await page.locator(".encounter-addressed-group summary").click();
  await page.getByRole("textbox",{name:"Sender identity",exact:true}).fill("agent:sender");
  await page.getByRole("textbox",{name:"Group recipients",exact:true}).fill(`${a.session} ${a.basis}\n${b.session} ${b.basis}`);
  await page.getByRole("textbox",{name:"Group audience",exact:true}).fill("agent:group-a, agent:group-b");
  await page.getByRole("textbox",{name:"Shared source refs",exact:true}).fill("source/shared");
  const packet="Return the exact token OI_DESKTOP_GROUP_OK. Do not use tools.";
  await page.getByRole("textbox",{name:"Addressed request text",exact:true}).fill(packet);
  check((await page.locator(".encounter-addressed-group .encounter-addressed-preview").innerText()).includes("2 recipients"),"The group composer previews the explicit recipients before any dispatch");
  await shot("group-composed");

  await page.locator(".encounter-addressed-group-send").click();
  await page.waitForFunction(()=>[...document.querySelectorAll(".encounter-addressed-group-row")].length===2&&[...document.querySelectorAll(".encounter-addressed-group-row")].every(row=>row.getAttribute("data-phase")==="returned"),null,{timeout:30000});
  const groupRef=await page.locator(".encounter-addressed-group-state").getAttribute("data-ref");
  check(true,"Every recipient settles on its own durable delivery result under one group delivery identity");
  const promptsA=providerPrompts(p.providerLogs[a.id]),promptsB=providerPrompts(p.providerLogs[b.id]);
  check(promptsA.length===1&&promptsB.length===1,"Each recipient's controlled provider received exactly one addressed prompt");
  check(JSON.stringify(promptsA[0]).includes("Selected Agent: agent:group-a")&&JSON.stringify(promptsB[0]).includes("Selected Agent: agent:group-b"),"Each prompt carries its own recipient's native selected-Agent identity");
  await shot("group-returned");

  // Whole-group privacy admission, owner-side. Omitting a recipient from the
  // packet audience is a per-participant disclosure denial; an audience that
  // disagrees with the admitted recipient set as a whole is the group's own
  // refusal. Both happen before any transport effect.
  await page.getByRole("textbox",{name:"Group audience",exact:true}).fill("agent:group-a");
  await page.locator(".encounter-addressed-group-send").click();
  await page.waitForFunction(()=>[...document.querySelectorAll(".encounter-addressed-group-row")].some(row=>row.getAttribute("data-phase")==="refused"),null,{timeout:30000});
  const audienceRefusal=await page.locator(".encounter-addressed-group-state").innerText();
  check(audienceRefusal.includes("encounter.disclosure_denied"),"An audience that omits a recipient is refused by that participant's own disclosure law, shown verbatim");
  check(providerPrompts(p.providerLogs[a.id]).length===1&&providerPrompts(p.providerLogs[b.id]).length===1,"A refused group dispatch produces no provider effect on any recipient");

  // An audience with a ref outside the admitted recipient set fails the
  // whole-group agreement check — still zero transport effect.
  await page.getByRole("textbox",{name:"Group audience",exact:true}).fill("agent:group-a, agent:group-b, agent:elsewhere");
  await page.locator(".encounter-addressed-group-send").click();
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-group-state")?.textContent?.includes("encounter.group_audience"),null,{timeout:30000});
  check(true,"An audience beyond the explicit recipient set is refused with the owner's group-agreement code");
  check(providerPrompts(p.providerLogs[a.id]).length===1&&providerPrompts(p.providerLogs[b.id]).length===1,"Still no provider effect from the refused group");

  // An undisclosed packet source refuses the whole group the same way — no
  // recipient is touched so another recipient's delivery cannot be inferred.
  await page.getByRole("textbox",{name:"Group audience",exact:true}).fill("agent:group-a, agent:group-b");
  await page.getByRole("textbox",{name:"Shared source refs",exact:true}).fill("source/undisclosed");
  await page.locator(".encounter-addressed-group-send").click();
  await page.waitForFunction(()=>[...document.querySelectorAll(".encounter-addressed-group-row")].some(row=>row.getAttribute("data-phase")==="refused"),null,{timeout:30000});
  check((await page.locator(".encounter-addressed-group-state").innerText()).includes("encounter.disclosure_denied"),"An undisclosed packet source refuses the whole group before the first transport effect");
  check(providerPrompts(p.providerLogs[a.id]).length===1&&providerPrompts(p.providerLogs[b.id]).length===1,"Still no provider effect from the refused group");
  await shot("group-refusals");

  // Duplicate law owner-side, at the same route the desktop uses: repeating
  // the exact group returns durable receipts per recipient, never a resend.
  const replay=p.request(a.session,"send-group",{delivery_ref:groupRef,sender:"agent:sender",packet:{text:packet,source_refs:["source/shared"],audience:["agent:group-a","agent:group-b"]},recipients:[{agent_session:a.session,expected_binding_revision:a.basis},{agent_session:b.session,expected_binding_revision:b.basis}]});
  check(replay.recipients.every(entry=>entry.result?.duplicate===true&&entry.result.delivery.phase==="returned"),"Repeating the exact group delivery identity returns durable receipts without resending");
  check(providerPrompts(p.providerLogs[a.id]).length===1&&providerPrompts(p.providerLogs[b.id]).length===1,"A duplicate group dispatch produces no second provider prompt");

  // Owner restart: the recorded native session is resumed only by explicit
  // reconnect; the durable receipts survive the restart.
  p.restartOwner();
  await page.getByRole("button",{name:"Group walk A (a)",exact:true}).click();
  const alert=page.locator(".encounter-composer [role='alert']");
  await alert.waitFor({timeout:30000});
  check((await alert.innerText()).includes("encounter.resume_required"),"After the owner restart a fresh open is refused — the recorded session's existence is disclosed by the owner's own code");
  const resumeButton=page.getByRole("button",{name:"Reconnect recorded session"});
  await resumeButton.waitFor();
  await resumeButton.click();
  await page.waitForFunction(()=>!!document.querySelector(".encounter-reconnected"),null,{timeout:60000});
  const nativeSession=await page.locator(".encounter-reconnected code").innerText();
  check(nativeSession==="fixture-native-stable","Reconnect resumes the actually recorded native session identity");
  await page.waitForFunction(()=>document.querySelector(".encounter-transcript")?.textContent?.includes("FIXTURE_REPLAY_BEFORE_LOAD"),null,{timeout:60000});
  check(true,"The reconnected transcript carries the loaded native session's own replayed material, not a fresh session");
  check(providerRequests(p.providerLogs[a.id],"session/load").length===1,"The provider log shows the explicit native load of the recorded session");
  await shot("reconnected-recorded-session");

  const durable=p.request(a.session,"delivery",{delivery_ref:groupRef});
  check(durable.phase==="returned","The group delivery receipt is durable across the owner restart");
  check(providerPrompts(p.providerLogs[a.id]).length===1,"The durable receipt read produces no new provider prompt");
}
