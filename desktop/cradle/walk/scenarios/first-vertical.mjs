// first-vertical (wave 6, one joined walk on the installed frozen cut): a real Central
// document opens, a passage is selected, the selection composes an addressed
// request to the resident agent (installed ai-kit frozen cut 62a238b — real
// Actuation admission, controlled protocol provider), the attributable reply
// arrives, and that reply is what the human reviews and includes through
// Central's native receiving operations (installed Central frozen cut 5d1b8bf,
// host-supplied credential, never document JSON).
//
// The identity join is by construction of the fixture ground: the Central
// agent principal (`agent:editor-walk`) is the same ref the addressed packet
// names as recipient, so the Return's producer attribution names the
// participant the request was addressed to. The reply content itself is
// carried verbatim into the submitted Return. Owner provisioning (agency,
// provider, policy, grants, document, the submit itself) is owner-side work
// through the owner CLIs exactly as §10 prescribes; the browser drive
// exercises the desktop consumer end to end. No new stores anywhere.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {blake3} from "hash-wasm";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","addressed-provider.py");
const HUMAN_TOKEN="vertical-walk-human-credential-not-a-real-secret";
const AGENT_TOKEN="vertical-walk-agent-credential-not-a-real-secret";
const sha256=value=>createHash("sha256").update(value).digest("hex");

export async function setup(args) {
  const source = await sourceSetup(args);
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
  const as = token => (action, input) => {
    const r = JSON.parse(execFileSync(ctrl, ["--root", source.root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8", env: {...process.env, ...source.env, CENTRAL_NATIVE_TOKEN: token}}));
    if (!r.ok) throw new Error(`${action} refused: ${JSON.stringify(r.error ?? r)}`);
    return r.data;
  };
  const human = as(HUMAN_TOKEN), agent = as(AGENT_TOKEN);
  const project = "Editor", projectId = "editor-walk";

  // --- Central owner-side seeding (pinned PR #155 integration-test shape):
  // three root policy sources with their relations, two credentialed principals.
  const relationsPath = join(source.root, "Control/relations/source-relations.json");
  mkdirSync(join(source.root, "Control/relations"), {recursive: true});
  let relations;
  try {relations = JSON.parse(readFileSync(relationsPath, "utf8"));}
  catch {relations = {schema: "central.control.ground-relations/v1", project_id: "control:root", relations: []};}
  const grants = [
    {principal_ref: "human:walk", actor_kind: "human", token_sha256: sha256(HUMAN_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"], expires_at_unix_seconds: 4000000000},
    {principal_ref: "agent:editor-walk", actor_kind: "agent", token_sha256: sha256(AGENT_TOKEN), scope_refs: ["control:root", `project:${projectId}`], actions: ["central.document.create", "central.document.mutate", "central.receiving.submit", "central.receiving.review", "central.receiving.include", "central.receiving.recover", "central.day.ensure"], expires_at_unix_seconds: 4000000000},
  ];
  const policies = [
    ["placement.json", "work-placement-policy", {schema: "central.work-placement-policy/v1", scope_ref: "control:root", writable: [{path: "Work/Editor", class: "repository"}], enforcement: "native-actions", required_coverage: ["file-content"], lease_seconds: 300}],
    ["time.json", "civil-time-policy", {schema: "central.civil-time-policy/v1", scope_ref: "control:root", timezone: "Europe/London", day_boundary_minutes: 0, automatic_day_rollover: true}],
    ["authority.json", "native-action-authority", {schema: "central.native-action-authority/v1", scope_ref: "control:root", grants}],
  ];
  relations.relations = relations.relations ?? [];
  for (const [name, role, value] of policies) {
    const path = `Control/user/${name}`;
    writeFileSync(join(source.root, path), JSON.stringify(value, null, 2));
    const ref = `central:source:control:root:${path}`;
    if (!relations.relations.some(entry => entry.ref === ref)) relations.relations.push({ref, path, roles: [role], provenance: "human-adopted", standing: "architecture-contract", treatment: "projectcentral-user", recognition: "controlled-walk-fixture-not-personal-adoption", recorded_at_unix_seconds: 1});
  }
  writeFileSync(relationsPath, JSON.stringify(relations, null, 2));

  const policy = as("")("central.work.policy", {project});
  // The real document the whole vertical runs against: created through the
  // owner's native operation, held as a real project source under Work/Editor.
  const doc = human("central.document.create", {project, kind: "flow", document_id: "doc:first-vertical", title: "First vertical document", expected_policy_revision: policy.revision, template_payload: {supplied: "value"}, fields: [{id: "vertical-field", label: "Vertical field", template_pointer: "/supplied"}]});
  if (!doc?.source?.ref) throw new Error(`document create returned no source: ${JSON.stringify(doc)}`);

  // --- AIKit owner-side provisioning (pinned PR #278 shape): SessionSpace,
  // agency admission through real Actuation, controlled provider, owner start.
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const actuationBin = process.env.OI_CAW_ACTUATION_BIN;
  if (!actuationBin) throw new Error("The addressed leg requires an explicit Actuation owner binding (OI_CAW_ACTUATION_BIN)");
  const suite=process.env.OI_BIN??"oi", router=join(source.root,"oi-owner-router.mjs");
  writeFileSync(router,`#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`);chmodSync(router,0o755);
  const env = {...process.env,...source.env,AIKIT_HOME:join(source.root,".aikit-home"),OI_BIN:router,OI_AIKIT_BIN:aikit,OI_AIKIT_SESSION_SPACE_BIN:sessionSpace,OI_CAW_ACTUATION_BIN:actuationBin,CENTRAL_NATIVE_TOKEN:HUMAN_TOKEN};
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace,["-C",source.projectRoot,...parts],{encoding:"utf8",env}));
  const bind = JSON.parse(execFileSync(aikit,["--json","-C",source.projectRoot,"project","bind","editor-walk","--directory",source.projectRoot,"--no-default-skill-sets"],{encoding:"utf8",env}));
  if(!bind.ok)throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply","--preview-json",JSON.stringify(preview));
  const space="session-space/first-vertical-walk",ref="agent-session/first-vertical-walk";
  apply(native("create",space,"--label","First vertical acceptance"));
  for(const intent of [
    {operation:"bind-project-context",binding:native("project-context")},
    {operation:"attach-agent-session",attachment:{agent_session:ref,purpose:"First vertical acceptance",provenance:["Explicit real joined vertical acceptance"]}},
  ])apply(native("stage","--space",space,"--intent-json",JSON.stringify(intent)));

  const agencyRequest={
    schema:"actuation.agency-actualisation/v1",
    request_ref:"actualisation-request:first-vertical-walk",
    requester_ref:"human:owner",
    governing_binding:{schema:"actuation.agency/v1",binding_ref:"binding:governing",agent_ref:"agent:governor",agency_ref:"agency:governing",world_ref:"world:personal",scope_ref:"scope:personal",bounds_refs:["bound:personal","bound:first-vertical-walk"],authority_refs:["authority:metagency","authority:first-vertical-walk"],return_relation_ref:"return-relation:governing"},
    metagency_grant:{schema:"actuation.agency/v1",grant_ref:"grant:first-vertical-walk",agency_ref:"agency:governing",world_binding_ref:"binding:governing",authority_ref:"authority:metagency",bounds_refs:["bound:first-vertical-walk"],operations:["determine-agency","actualise-agency"]},
    determination:{schema:"actuation.agency/v1",determination_ref:"determination:first-vertical-walk",kind:"delegation",determining_agency_ref:"agency:governing",differentiated_agency_ref:"agency:editor-walk",world_binding_ref:"binding:editor-walk",bounds_refs:["bound:first-vertical-walk"],authority_refs:["authority:first-vertical-walk"],delegated_autonomy:{allowed_action_refs:["action/aikit/encounter-send"],denied_action_refs:["action:source-mutation"],may_determine_within_bounds:true},return_policy:{mode:"required",return_relation_ref:"return-relation:first-vertical-walk"}},
    differentiated_binding:{schema:"actuation.agency/v1",binding_ref:"binding:editor-walk",agent_ref:"agent:editor-walk",agency_ref:"agency:editor-walk",world_ref:"central:project:editor-walk",scope_ref:"central:project:editor-walk:scope",determining_agency_ref:"agency:governing",bounds_refs:["bound:first-vertical-walk"],authority_refs:["authority:first-vertical-walk"],return_relation_ref:"return-relation:first-vertical-walk",continuity_ref:"continuity:agent:editor-walk"},
    agent_identity:{standing:"existing",evidence_refs:["evidence/declared-walk-identity"]},
    provenance:{source_refs:["source/first-vertical-walk"],context_refs:[]},
  };
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
    // The participant's transport disclosure admits the real document the
    // vertical is joined around — the composed request shares its exact
    // Central source ref, and anything else stays undisclosed.
    allowed_packet_sources:[doc.source.ref],
    context:{sources:[{source:"source/editor-walk-context",revision:"rev/context-1",path:contextPath,content_digest:"blake3:"+await blake3(contextText)}],source_activations:[],projection:null,activation:null},
  };
  native("encounter-agency-configure","--agent-session",ref,"--binding-json",JSON.stringify(binding));
  native("encounter-configure","--provider-json",JSON.stringify({id:"vertical-acp",label:"First vertical ACP",protocol:"acp",argv:["python3","-u",providerScript,"acp",providerLog]}));
  const owner=native("encounter-start");if(!owner.ok)throw new Error(JSON.stringify(owner));

  return {...source,env,human,agent,doc,space,ref,providerLog,cleanup:()=>{try{process.kill(-owner.data.pid,"SIGTERM");}catch{}source.cleanup();}};
}

async function selectRange(editor,start,end) {
  await editor.focus();await editor.press("Meta+ArrowUp");
  for(let i=0;i<start;i++)await editor.press("ArrowRight");
  for(let i=start;i<end;i++)await editor.press("Shift+ArrowRight");
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
  const passage="First vertical document";
  const docPath=join(p.root,"Work/Editor",p.doc.source.path);
  const content=readFileSync(docPath,"utf8");
  const start=content.indexOf(`"${passage}"`);
  if(start<0)throw new Error(`the created document does not carry its title: ${content.slice(0,200)}`);

  await page.goto(baseUrl);await channel("info");
  const nav=page.getByRole("complementary",{name:"World navigator"});
  // 1 — the resident agent conversation opens over the real AIKit encounter.
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button",{name:"Editor: chats and tasks",exact:true}).click();
  await page.getByRole("button",{name:"First vertical acceptance",exact:true}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  await page.getByRole("button",{name:"First vertical ACP",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".encounter-connect"),null,{timeout:60000});
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-service")?.getAttribute("data-service")==="running",null,{timeout:30000});
  check(true,"The resident agent conversation is open with the native dispatch service disclosed");

  // 2 — the real document opens through the ordinary navigator file route.
  // The native document source lives under the project's ProjectCentral scope
  // (owner fact: `agents/now/flows/<key>.json` below ProjectCentral), which the
  // navigator expands by default.
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  await nav.getByRole("button",{name:"Editor: files",exact:true}).click();
  for(const folder of ["ProjectCentral/agents","ProjectCentral/agents/now","ProjectCentral/agents/now/flows"]) {
    await nav.locator(`[data-file-path="Work/Editor/${folder}"]`).click();
  }
  await nav.locator(`[data-file-path="Work/Editor/${p.doc.source.path}"]`).click();
  const editor=page.locator(`.cm-content[data-source-ref="${p.doc.source.ref}"]`);
  await editor.waitFor({timeout:15000});
  check((await editor.innerText()).includes(passage),"The native document opens through the navigator and renders its own bytes");
  await shot("document-open");

  // 3 — select a passage; the context tray offers the addressed destination.
  await selectRange(editor,start+1,start+1+passage.length);
  await page.getByRole("button",{name:"Context mode",exact:true}).click();
  await page.getByRole("button",{name:"Attach selection",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Include selected context"});await dialog.waitFor();
  check(await dialog.locator("pre").innerText()===passage,"The tray presents the exact selected passage from the real document");
  await shot("selection-in-tray");
  await dialog.getByRole("button",{name:"Address to the participant"}).click();
  await dialog.waitFor({state:"detached"});

  // 4 — back on the conversation, the addressed composer holds the selection:
  // exact source ref, quote, selection-time revision. Sender/audience/basis
  // stay explicit inputs. (Surfaces unmount with their tab, so the composition
  // is consumed when this composer renders again.)
  await page.locator(".tab").filter({hasText:"First vertical acceptance"}).click();
  await page.getByRole("textbox",{name:"Message",exact:true}).waitFor();
  const selectionRef=await page.locator(".encounter-addressed-selection code").innerText();
  check(selectionRef===p.doc.source.ref,"The composed request carries the document's exact Central source ref");
  const requestText=await page.getByRole("textbox",{name:"Addressed request text",exact:true}).inputValue();
  check(requestText.includes(`> ${passage}`)&&requestText.includes(`revision ${p.doc.revision.revision}`),"The composed request quotes the exact passage at its selection-time revision");
  check((await page.locator(".encounter-addressed-preview").innerText()).includes("1 source ref"),"The preview names the one shared source scope");
  await page.getByRole("textbox",{name:"Sender identity",exact:true}).fill("agent:sender");
  await page.getByRole("textbox",{name:"Recipient agent",exact:true}).fill("agent:editor-walk");
  await page.getByRole("textbox",{name:"Expected participation basis",exact:true}).fill("rev/1");
  await page.getByRole("textbox",{name:"Message",exact:true}).fill("HUMAN_DRAFT_NEVER_SENT_MARKER");
  await shot("addressed-composed-from-selection");

  // 5 — dispatch; the attributable reply arrives through the ordinary read path.
  await page.locator(".encounter-addressed-send").click();
  await page.waitForFunction(()=>document.querySelector(".encounter-addressed-state")?.getAttribute("data-phase")==="returned",null,{timeout:30000});
  const deliveryRef=await page.locator(".encounter-addressed-state code").first().innerText();
  await page.waitForFunction(()=>document.querySelector(".encounter-transcript")?.textContent?.includes("FIXTURE_REPLY"),null,{timeout:60000});
  check(true,"The participant's reply reaches the canonical transcript through the ordinary read path");
  await shot("reply-in-transcript");

  const prompts=readFileSync(p.providerLog,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line)).filter(m=>m.method==="session/prompt");
  check(prompts.length===1,"The controlled provider received exactly one addressed prompt");
  const promptText=JSON.stringify(prompts[0]);
  check(promptText.includes("Selected Agent: agent:editor-walk")&&promptText.includes(p.doc.source.ref)&&promptText.includes(passage),"The prompt carries the native selected-Agent header, the document's source ref and the exact passage");
  check(!promptText.includes("HUMAN_DRAFT_NEVER_SENT_MARKER"),"The human draft buffer never rides the addressed machine turn");

  // 6 — the owner-side join: the reply, verbatim, is submitted as a Return by
  // the same participant ref through Central's real receiving operation
  // (owner-side credential, never the desktop, never document JSON).
  const observed=await page.evaluate(()=>document.querySelector(".encounter-transcript")?.textContent?.match(/FIXTURE_REPLY/)?.[0]);
  if(!observed)throw new Error("the transcript reply token was not found for the owner-side submit");
  const submitted=p.agent("central.receiving.submit",{project:"Editor",producer_key:"producer:first-vertical",source_ref:p.doc.source.ref,document_id:p.doc.document_id,expected_source_revision:p.doc.revision.revision,occurred_at_unix_seconds:42,task_ref:`delivery:${deliveryRef}`,session_ref:"agent-session/first-vertical-walk",proposal:{operation:"entry.add",entry_id:"entry:vertical",contribution_id:"part:vertical",html:`<p>${observed}</p>`}});
  if(submitted.record.status!=="pending")throw new Error(`the reply's Return arrived ${submitted.record.status}`);

  // 7 — the human reviews and includes that Return against the document.
  if(!await nav.isVisible())await page.keyboard.press("Meta+b");
  const tray=nav.locator(".project-returns").first();
  await tray.getByRole("button",{name:"Refresh returns"}).click();
  await page.waitForFunction(()=>document.querySelector(".project-returns header small")?.textContent?.includes("1 in the receiving field"),null,{timeout:20000});
  await tray.locator(".project-return").first().click();
  const detail=tray.locator(".return-detail");await detail.waitFor();
  check((await detail.innerText()).includes("Agent — agent:editor-walk"),"The Return's producer attribution names the addressed participant");
  check((await detail.innerText()).includes("entry.add")&&(await detail.innerText()).includes(observed),"The exact proposed operation and the verbatim reply content are shown before any decision");
  check((await detail.innerText()).includes(p.doc.revision.revision),"The Return shows the exact basis revision — the same revision the selection recorded");
  await shot("return-of-the-reply-before-review");

  await tray.getByRole("button",{name:"Accept current basis"}).click();
  await page.waitForFunction(()=>document.querySelector(".project-returns .return-detail")?.textContent?.includes("accepted by"),null,{timeout:20000});
  await tray.getByRole("button",{name:"Include into the document"}).click();
  await page.waitForFunction(()=>document.querySelector(".project-return .return-status")?.textContent==="included",null,{timeout:20000});
  check(true,"The human accepts the exact current basis and includes the reply through the owner's revision-checked operation");
  await shot("reply-included");

  // 8 — the document now holds the agent's reviewed reply as native facts.
  const finalDoc=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});
  const contributions=finalDoc.document.contributions;
  check(contributions.length===1&&contributions[0].html.includes(observed),"The document holds exactly the reviewed reply content");
  check(contributions[0].author_ref==="agent:editor-walk"&&contributions[0].display_role==="Agent"&&contributions[0].reviewed_by==="human:walk","Producer attribution and human review are carried as distinct native facts");
  check(finalDoc.revision.revision!==p.doc.revision.revision,"The document source revision advanced through the inclusion");
  check(readFileSync(docPath,"utf8").includes("entry:vertical"),"The proposed entry anchor exists in the real document bytes");
  await shot("document-holds-reviewed-reply");
}
