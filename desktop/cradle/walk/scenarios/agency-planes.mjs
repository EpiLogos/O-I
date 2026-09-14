// agency-planes (6C cell 1): the Activity plane of the agency panel leads
// through the actual resident session — the provider's real working material
// (thinking, tool calls, a REAL consent round-trip answered through the
// desktop's consent card, a Stop, a provider fault with reconnect recovery),
// the owner's own wait states, and the raw journal on the owner's cursor —
// all disclosed by the installed ai-kit frozen cut (62a238b) and a controlled
// protocol fixture (D/C evidence, never model proof). Nothing is invented:
// every row is the owner's own block, connection state or journal event.
import {execFileSync} from "node:child_process";
import {chmodSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
import {blake3} from "hash-wasm";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","activity-provider.py");

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
  const space="session-space/agency-planes-walk",ref="agent-session/agency-planes-walk";
  apply(native("create",space,"--label","Addressed dispatch acceptance"));
  for(const intent of [
    {operation:"bind-project-context",binding:native("project-context")},
    {operation:"attach-agent-session",attachment:{agent_session:ref,purpose:"Agency planes acceptance",provenance:["Explicit real agency-planes acceptance"]}},
  ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));

  // Selected-Agency admission: the staged agency source goes through the real
  // Actuation owner (`actuation agency actualise`) at configure time and at
  // every addressed send — the owner validates bytes, digest and authority.
  const agencyRequest={
    schema:"actuation.agency-actualisation/v1",
    request_ref:"actualisation-request:agency-planes-walk",
    requester_ref:"human:owner",
    governing_binding:{schema:"actuation.agency/v1",binding_ref:"binding:governing",agent_ref:"agent:governor",agency_ref:"agency:governing",world_ref:"world:personal",scope_ref:"scope:personal",bounds_refs:["bound:personal","bound:agency-planes-walk"],authority_refs:["authority:metagency","authority:agency-planes-walk"],return_relation_ref:"return-relation:governing"},
    metagency_grant:{schema:"actuation.agency/v1",grant_ref:"grant:agency-planes-walk",agency_ref:"agency:governing",world_binding_ref:"binding:governing",authority_ref:"authority:metagency",bounds_refs:["bound:agency-planes-walk"],operations:["determine-agency","actualise-agency"]},
    determination:{schema:"actuation.agency/v1",determination_ref:"determination:agency-planes-walk",kind:"delegation",determining_agency_ref:"agency:governing",differentiated_agency_ref:"agency:editor-walk",world_binding_ref:"binding:editor-walk",bounds_refs:["bound:agency-planes-walk"],authority_refs:["authority:agency-planes-walk"],delegated_autonomy:{allowed_action_refs:["action/aikit/encounter-send"],denied_action_refs:["action:source-mutation"],may_determine_within_bounds:true},return_policy:{mode:"required",return_relation_ref:"return-relation:agency-planes-walk"}},
    differentiated_binding:{schema:"actuation.agency/v1",binding_ref:"binding:editor-walk",agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",world_ref:"central:project:editor-walk",scope_ref:"central:project:editor-walk:scope",determining_agency_ref:"agency:governing",bounds_refs:["bound:agency-planes-walk"],authority_refs:["authority:agency-planes-walk"],return_relation_ref:"return-relation:agency-planes-walk",continuity_ref:"continuity:agent:editor-walk"},
    agent_identity:{standing:"existing",evidence_refs:["evidence/declared-walk-identity"]},
    provenance:{source_refs:["source/agency-planes-walk"],context_refs:[]},
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
  const providerLog=join(source.root,"activity-provider.log");
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
  native("encounter-configure","--provider-json",JSON.stringify({id:"activity-acp",label:"Activity acceptance ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]}));
  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));
  const request=(action,fields={})=>{const result=native("encounter","--request-json",JSON.stringify({action,agent_session:ref,...fields}));if(!result.ok)throw new Error(JSON.stringify(result));return result.data;};
  return {...source,env,native,request,space,ref,providerLog,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{} if(!process.env.LEAVE_KEEP)source.cleanup();}};
}

const providerPrompts=log=>readFileSync(log,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"Agency planes acceptance",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  const planeButtons=page.locator(".encounter-planes");
  const toActivity=()=>planeButtons.getByRole("button",{name:"Activity"}).click();
  const toConversation=()=>planeButtons.getByRole("button",{name:"Conversation"}).click();

  // Before any turn the Activity plane is honestly empty: no fabricated rows.
  await page.getByRole("button",{name:"Activity acceptance ACP",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});
  await toActivity();
  await page.getByText("No provider activity in this transcript page.").waitFor({timeout:15000});
  check(true,"With no turns, the Activity plane discloses exactly that — no invented activity");
  await shot("activity-empty-honest");

  // --- A real provider-consent round-trip, answered through the desktop ----
  await toConversation();
  const message=page.getByRole("textbox",{name:"Message",exact:true});
  await message.fill("ACTIVITY_CONSENT");
  await page.locator(".encounter-send").click();
  const consent=page.locator(".encounter-permission");
  await consent.waitFor({timeout:30000});
  check((await consent.innerText()).includes("Fixture write"),"The provider's consent request is disclosed with its actual tool call before any answer");
  await shot("activity-consent-requested");
  await toActivity();
  await page.locator('details.encounter-thinking[data-kind="permission"]').waitFor({timeout:15000});
  check(true,"The consent request is also activity beside the conversation, not only a composer card");
  await toConversation();
  await consent.getByRole("button",{name:"Allow once"}).click();
  await page.waitForFunction(()=>document.querySelector(".encounter-transcript")?.textContent?.includes("CONSENT_ANSWERED:allow-once"),null,{timeout:30000});
  check(true,"Answering the card reaches the provider over the real consent wire and the turn completes");
  await shot("activity-consent-answered");

  // --- An addressed machine turn, then the Inspect plane's registrations ----
  // (6B's named open: delivery identities become inspectable semantic refs.)
  await page.getByRole("textbox",{name:"Sender identity",exact:true}).fill("agent:sender");
  await page.getByRole("textbox",{name:"Recipient agent",exact:true}).fill("agent:editor-walk");
  await page.getByRole("textbox",{name:"Expected participation basis",exact:true}).fill("rev/1");
  await page.getByRole("textbox",{name:"Shared source refs",exact:true}).fill("source/shared");
  await page.getByRole("textbox",{name:"Addressed request text",exact:true}).fill("ACTIVITY_ADDRESSED_OK");
  await page.locator(".encounter-addressed-send").click();
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-state")?.getAttribute("data-phase")==="returned",null,{timeout:30000});
  const addressedRef=await page.locator(".encounter-addressed-state code").first().innerText();
  await page.locator(".encounter-planes").getByRole("button",{name:"Inspect"}).click();
  const inspect=page.locator(".encounter-inspect");
  const deliveryRow=inspect.locator(".encounter-deliveries li").filter({hasText:addressedRef});
  await deliveryRow.waitFor({timeout:15000});
  check((await deliveryRow.innerText()).includes("returned"),"A dispatched delivery identity is inspectable with its settled owner phase — 6B's named open, closed");
  check((await inspect.innerText()).includes("session-space/agency-planes-walk"),"The Inspect plane names the stable SessionSpace ref the encounter actually lives in");
  check((await inspect.innerText()).includes("fixture-native-stable"),"The Inspect plane names the provider's actual native session identity");
  const cancelAction=inspect.locator(".encounter-actions li").filter({hasText:"aikit.encounter.cancel"});
  // Disabled actions show the OWNER's reason, not a desktop verdict.
  check((await cancelAction.innerText()).includes("There is no active provider turn"),"Owner operations are shown with the owner's own verdicts and reasons, never the desktop's");
  await shot("activity-inspect-deliveries");

  // --- The Context plane keeps the three correlated facts distinct ----------
  await page.locator(".encounter-planes").getByRole("button",{name:"Context"}).click();
  const context=page.locator(".encounter-context-facts");
  await context.waitFor({timeout:15000});
  const contextText=await context.innerText();
  check(contextText.includes("Conversation plane")&&contextText.includes("not a second copy"),"Recorded history is pointed at, not duplicated into the Context plane");
  check((await context.locator('[data-fact="operative-context-absent"]').innerText()).includes("does not infer it"),"The participant's operative context is disclosed as un-inspectable on this cut — never inferred from transcript or profile");
  check((await context.locator('[data-fact="continuation"]').innerText()).includes("fixture-native-stable"),"The provider's actual continuation state names the native session the provider really holds");
  await shot("activity-context-facts");
  await page.locator(".encounter-planes").getByRole("button",{name:"Conversation"}).click();

  // --- Thinking, tools, and the owner's own in-flight wait ------------------
  await message.fill("ACTIVITY_THINK_TOOL");
  await page.locator(".encounter-send").click();
  await toActivity();
  await page.locator(".encounter-wait").waitFor({timeout:15000});
  check((await page.locator(".encounter-wait").innerText()).includes("in flight"),"The wait row is the owner's own connection state, not a progress invention");
  await page.locator('details.encounter-thinking[data-kind="thinking"]').waitFor({timeout:20000});
  // The owner journals the tool_call AND its update as separate blocks —
  // both are real activity; assert on the one carrying the call's identity.
  const toolBlock=page.locator('details.encounter-thinking[data-kind="tool"]').filter({hasText:"fixture-tool-1"}).first();
  await toolBlock.waitFor({timeout:20000});
  const toolText=await toolBlock.evaluate(el=>el.textContent??"");
  check(toolText.includes("fixture-tool-1"),"The tool call's real payload is the activity row");
  const activityText=await page.locator(".encounter-transcript").innerText();
  check(!activityText.includes("FIXTURE_REPLY"),"The assistant's conversational reply stays in the Conversation plane — the planes do not duplicate each other");
  await shot("activity-thought-tool-wait");

  // --- Stop: the owner journals the cancellation ----------------------------
  await toConversation();
  await message.fill("ACTIVITY_HOLD");
  await page.locator(".encounter-send").click();
  await page.locator(".encounter-stop").waitFor({timeout:15000});
  await page.locator(".encounter-stop").click();
  await toActivity();
  // OWNER FINDING (frozen cut 62a238b, recorded in the ledger, not papered
  // over desktop-side): TurnStop serializes externally, so the store's
  // stop matcher cannot recognize the unit variants — an interrupted turn
  // journals as kind=error whose text names the real stop ("Cancelled").
  // The desktop shows the owner's record verbatim and reinterprets nothing.
  await page.waitForFunction(()=>document.querySelector(".encounter-transcript")?.textContent?.includes("Provider turn failed"),null,{timeout:30000});
  const stopRow=page.locator(".encounter-turn.encounter-error").filter({hasText:"Cancelled"}).first();
  await stopRow.waitFor({timeout:15000});
  check((await stopRow.evaluate(el=>el.textContent??"")).includes('"Cancelled"'),"A requested stop settles as the owner's own stop record, shown verbatim — the owner journals the interruption as an error-named-Cancelled (owner finding, frozen cut)");
  await shot("activity-stopped");

  // --- Provider fault: the failure is shown, and recovery is the owner's ----
  await toConversation();
  await message.fill("CONTROLLED_DISCONNECT");
  await page.locator(".encounter-send").click();
  await toActivity();
  await page.locator(".encounter-fault").waitFor({timeout:30000});
  check((await page.locator(".encounter-fault").innerText()).includes("connection fault"),"A provider failure is disclosed as a fault, never softened into activity-as-usual");
  await shot("activity-fault");
  await toConversation();
  // The faulted resident keeps its seat: the desktop discloses the held seat
  // and names the recovery route it cannot call, rather than promising a
  // reconnect the owner would answer with the same dead transport.
  await page.locator(".encounter-fault-held").waitFor({timeout:30000});
  const held=await page.locator(".encounter-fault-held").innerText();
  check(held.includes("holds the recorded session")&&held.includes("recovery is the owner"), "A faulted resident's seat is disclosed as held, with recovery named as the owner's — no recovery promise the owner cannot keep");
  await shot("activity-fault-held-seat");

  // --- The owner journal: the raw events behind the transcript --------------
  await toActivity();
  const journal=page.locator(".encounter-journal");
  await journal.locator("summary").click();
  await journal.getByRole("button",{name:"Load journal"}).click();
  await page.locator(".encounter-journal-list li").first().waitFor({timeout:20000});
  const journalText=await page.locator(".encounter-journal").innerText();
  check(journalText.includes("user-message"),"The journal's raw events include the human turns on the owner's own cursor");
  check(journalText.includes("provider"),"The journal names provider events as the owner recorded them");
  check(journalText.includes("cursor"),"Journal rows carry the owner's cursors, not desktop numbering");
  await shot("activity-journal");
}
