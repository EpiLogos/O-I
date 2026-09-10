// select-send (6B, cut 1): the desktop dispatches an explicit addressed turn to a
// real resident agent session through the pinned ai-kit candidate (PR #278 head),
// with a real Actuation owner admitting the selected Agency, and a controlled
// protocol provider (FIXTURE_REPLY — D/C evidence, never model proof).
//
// Owner provisioning (agency source, binding, provider) is owner-side work done
// through the owner CLI exactly as §10 prescribes; the browser drive exercises the
// desktop consumer: service disclosure, exact preview, dispatch, durable delivery
// states, transcript readback, the human-draft boundary, the owner's duplicate law
// and the owner's structured disclosure refusal.
import {execFileSync} from "node:child_process";
import {chmodSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
import {blake3} from "hash-wasm";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","addressed-provider.py");

export async function setup(args) {
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const actuationBin = process.env.OI_CAW_ACTUATION_BIN;
  if (!actuationBin) throw new Error("Addressed dispatch requires an explicit Actuation owner binding (OI_CAW_ACTUATION_BIN)");
  const suite=process.env.OI_BIN??"oi", router=join(source.root,"oi-owner-router.mjs");
  writeFileSync(router,`#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`);chmodSync(router,0o755);
  const env = {...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_BIN:router,OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace,OI_CAW_ACTUATION_BIN:actuationBin};
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bind = JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply","--preview-json",JSON.stringify(preview));
  const space="session-space/select-send-walk",ref="agent-session/select-send-walk";
  apply(native("create",space,"--label","Addressed dispatch acceptance"));
  for(const intent of [
    {operation:"bind-project-context",binding:native("project-context")},
    {operation:"attach-agent-session",attachment:{agent_session:ref,purpose:"Addressed dispatch acceptance",provenance:["Explicit real addressed-dispatch acceptance"]}},
  ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));

  // Selected-Agency admission: the staged agency source goes through the real
  // Actuation owner (`actuation agency actualise`) at configure time and at
  // every addressed send — the owner validates bytes, digest and authority.
  const agencyRequest={
    schema:"actuation.agency-actualisation/v1",
    request_ref:"actualisation-request:select-send-walk",
    requester_ref:"human:owner",
    governing_binding:{schema:"actuation.agency/v1",binding_ref:"binding:governing",agent_ref:"agent:governor",agency_ref:"agency:governing",world_ref:"world:personal",scope_ref:"scope:personal",bounds_refs:["bound:personal","bound:select-send-walk"],authority_refs:["authority:metagency","authority:select-send-walk"],return_relation_ref:"return-relation:governing"},
    metagency_grant:{schema:"actuation.agency/v1",grant_ref:"grant:select-send-walk",agency_ref:"agency:governing",world_binding_ref:"binding:governing",authority_ref:"authority:metagency",bounds_refs:["bound:select-send-walk"],operations:["determine-agency","actualise-agency"]},
    determination:{schema:"actuation.agency/v1",determination_ref:"determination:select-send-walk",kind:"delegation",determining_agency_ref:"agency:governing",differentiated_agency_ref:"agency:editor-walk",world_binding_ref:"binding:editor-walk",bounds_refs:["bound:select-send-walk"],authority_refs:["authority:select-send-walk"],delegated_autonomy:{allowed_action_refs:["action/aikit/encounter-send"],denied_action_refs:["action:source-mutation"],may_determine_within_bounds:true},return_policy:{mode:"required",return_relation_ref:"return-relation:select-send-walk"}},
    differentiated_binding:{schema:"actuation.agency/v1",binding_ref:"binding:editor-walk",agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",world_ref:"central:project:editor-walk",scope_ref:"central:project:editor-walk:scope",determining_agency_ref:"agency:governing",bounds_refs:["bound:select-send-walk"],authority_refs:["authority:select-send-walk"],return_relation_ref:"return-relation:select-send-walk",continuity_ref:"continuity:agent:editor-walk"},
    agent_identity:{standing:"existing",evidence_refs:["evidence/declared-walk-identity"]},
    provenance:{source_refs:["source/select-send-walk"],context_refs:[]},
  };
  // Provisioned sources must live at a lexically real path: the owner refuses
  // agency sources that redirect through a symlink, and macOS /var is one.
  const realRoot=realpathSync(source.root);
  const agencyPath=join(realRoot,"editor-walk-agency.json");
  const agencyBytes=Buffer.from(JSON.stringify(agencyRequest,null,2));
  writeFileSync(agencyPath,agencyBytes);
  const contextPath=join(realRoot,"editor-walk-context.md");
  const contextText="SELECTED_CONTEXT: the owner's scoped writing material for the addressed turn.\n";
  writeFileSync(contextPath,contextText);
  const providerLog=join(source.root,"addressed-provider.log");
  const binding={
    revision:"rev/1",active:true,
    agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",
    world_ref:"central:project:editor-walk",world_binding_ref:"binding:editor-walk",
    agency_source:{source_ref:"source/editor-walk",revision:"rev/native-1",path:agencyPath,content_digest:"blake3:"+await blake3(agencyBytes)},
    actuation_bin:actuationBin,
    allowed_senders:["human:owner","agent:sender"],
    allowed_packet_sources:["source/shared"],
    context:{sources:[{source:"source/editor-walk-context",revision:"rev/context-1",path:contextPath,content_digest:"blake3:"+await blake3(contextText)}],source_activations:[],projection:null,activation:null},
  };
  native("encounter-agency-configure","--agent-session",ref,"--binding-json",JSON.stringify(binding));
  native("encounter-configure","--provider-json",JSON.stringify({id:"addressed-acp",label:"Addressed acceptance ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]}));
  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  const request=(action,fields={})=>{const result=native("encounter","--request-json",JSON.stringify({action,agent_session:ref,...fields}));if(!result.ok)throw new Error(JSON.stringify(result));return result.data;};
  return {...source,env,native,request,space,ref,providerLog,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

const providerPrompts=log=>readFileSync(log,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"Addressed dispatch acceptance",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  await page.getByRole("button",{name:"Addressed acceptance ACP",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});

  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-service")?.getAttribute("data-service")==="running",null,{timeout:30000});
  check(true,"The addressed section discloses the native dispatch service before any turn is composed");
  const sendButton=page.locator(".encounter-addressed-send");
  check(await sendButton.isDisabled(),"Nothing is dispatched until the addressed turn is fully composed");

  await page.getByRole("textbox",{name:"Sender identity",exact:true}).fill("agent:sender");
  await page.getByRole("textbox",{name:"Recipient agent",exact:true}).fill("agent:editor-walk");
  await page.getByRole("textbox",{name:"Expected participation basis",exact:true}).fill("rev/1");
  await page.getByRole("textbox",{name:"Shared source refs",exact:true}).fill("source/shared");
  // The human draft is composed but never sent: it must stay in AIKit's draft
  // store and never ride an addressed machine turn to the provider.
  await page.getByRole("textbox",{name:"Message",exact:true}).fill("HUMAN_DRAFT_NEVER_SENT_MARKER");
  const packet="Return the exact token OI_DESKTOP_ADDRESSED_OK. Do not use tools.";
  await page.getByRole("textbox",{name:"Addressed request text",exact:true}).fill(packet);
  await page.locator(".encounter-addressed-preview").filter({hasText:"agent:sender → agent:editor-walk"}).waitFor();
  check((await page.locator(".encounter-addressed-preview").innerText()).includes("1 source ref"),"The composer previews the exact sender, recipient, basis and shared source scope");
  await shot("addressed-composed-before-dispatch");

  await sendButton.click();
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-state")?.getAttribute("data-phase")==="returned",null,{timeout:30000});
  const settled=await page.locator(".encounter-addressed-state").innerText();
  check(settled.includes("not task success")&&settled.includes("returned"),"A settled delivery shows the owner phase with the honest not-task-success standing");
  const deliveryRef=await page.locator(".encounter-addressed-state code").first().innerText();
  // An addressed turn is not a human turn: with no prior user block the owner
  // attributes the reply as provider material (provider-notice), so assert on
  // the transcript content, not on an assistant-shaped bubble.
  await page.waitForFunction(()=>document.querySelector(".encounter-transcript")?.textContent?.includes("FIXTURE_REPLY"),null,{timeout:60000});
  check(true,"The provider's reply reaches the canonical transcript through the ordinary read path");

  const prompts=providerPrompts(p.providerLog);
  check(prompts.length===1,"The controlled provider received exactly one addressed prompt");
  const promptText=JSON.stringify(prompts[0]);
  check(promptText.includes("Selected Agent: agent:editor-walk")&&promptText.includes(packet),"The addressed prompt carries the native selected-Agent identity header and the exact committed packet text");
  check(!promptText.includes("HUMAN_DRAFT_NEVER_SENT_MARKER"),"The human draft buffer never rides an addressed machine turn");
  await shot("addressed-returned-with-transcript");

  // Duplicate law (owner-side, exercised at the same route the desktop uses):
  // the exact same delivery identity returns its durable receipt, never a resend.
  const replay=p.request("send",{turn:{delivery_ref:deliveryRef,sender:"agent:sender",expected_binding_revision:"rev/1",packet:{text:packet,source_refs:["source/shared"],audience:["agent:editor-walk"]}}});
  check(replay.duplicate===true&&replay.delivery.phase==="returned","Repeating the exact delivery identity returns the durable receipt without resending");
  check(providerPrompts(p.providerLog).length===1,"A duplicate delivery produces no second provider prompt");

  // Disclosure refusal: an audience outside the participant's explicit transport
  // disclosure is refused by the owner with its own code, surfaced verbatim.
  await page.getByRole("textbox",{name:"Recipient agent",exact:true}).fill("agent:elsewhere");
  await sendButton.click();
  const refusal=page.locator(".encounter-addressed-refusal");
  await refusal.waitFor();
  check((await refusal.innerText()).includes("encounter.disclosure_denied"),"An undisclosed audience is refused with the owner's structured disclosure code, shown verbatim");
  check(providerPrompts(p.providerLog).length===1,"A refused turn produces no provider effect");
  await shot("addressed-disclosure-refusal");
}
