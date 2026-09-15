import {execFileSync,spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";
import {createParticipant,reviseProjection,withdrawProjection} from "../../../../shared-field/index.mjs";
import {projectCentralWikiWorld,hostedPublicationArgs,publicationSentinelLeaks} from "../../../../shared-field/central-wiki-projection.mjs";
import {worldPresentationFromProjection} from "../../../../shared-field/presentation-projection.mjs";
import {nativeReturnSubmission} from "../../../../shared-field/contribution-return.mjs";

const HUMAN_TOKEN="sf4-owner-native-credential-for-isolated-acceptance";
const READER_TOKEN="sf4-contributor-native-credential-for-isolated-acceptance";
const SENTINEL="SF4_PRIVATE_SENTINEL_NEVER_PROJECT";
const sha256=value=>createHash("sha256").update(value).digest("hex");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function bridgeOp(url,op,request){
 const envelope=await (await fetch(`${url}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op,request})})).json();
 if(envelope.error||envelope.outcome?.failure)throw new Error(`${op} failed: ${JSON.stringify(envelope.error??envelope.outcome.failure)}`);
 return envelope.outcome?.data;
}

const OWNER_BRIDGE_PORT=4287;

async function startOwnerBridge(cradleRoot,ownerEnv,port=OWNER_BRIDGE_PORT){
 // A fixed port: the scenario stops its own bridge before starting another,
 // so the browser's stable bridge URL survives an owner-connection restart.
 const child=spawn("cargo",["run","--quiet","--manifest-path",join(cradleRoot,"kernel/Cargo.toml"),"--bin","walk-bridge","--",`127.0.0.1:${port}`],{cwd:cradleRoot,detached:true,stdio:["ignore","pipe","pipe"],env:{...process.env,...ownerEnv,OI_SHARED_FIELD_TOKEN_LABEL:"sf4-a",CENTRAL_NATIVE_TOKEN:HUMAN_TOKEN}});
 let output="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);
 const stop=()=>{try{process.kill(-child.pid,"SIGTERM");}catch{child.kill("SIGTERM");}};
 const url=`http://127.0.0.1:${port}`;
 const deadline=Date.now()+180000;
 for(;;){
  if(child.exitCode!==null){stop();throw new Error(`owner bridge exited before readiness (${child.exitCode}): ${output}`);}
  try{if((await fetch(`${url}/state`)).ok)break;}catch{}
  if(Date.now()>deadline){stop();throw new Error(`owner bridge did not start: ${output}`);}
  await sleep(100);}
 return {url,stop};
}

/** A fresh owner connection: the long-lived hosted view can wedge, and the
 * remedy is the owner's own remedy — restart the connection. The Expression
 * is reopened from its exact disclosed document; nothing else lives in
 * kernel memory for this scenario. */
async function restartOwnerBridge(p){
 p.ownerBridge.stop();
 p.ownerBridge=await startOwnerBridge(p.cradleRoot,p.ownerEnv);
 const bridgeIdentity=(await bridgeOp(p.ownerBridge.url,"shared_field",{kind:"identity"})).transport_identity;
 if(bridgeIdentity!==p.ownerIdentity)throw new Error(`owner bridge identity mismatch after restart: expected ${p.ownerIdentity}, got ${bridgeIdentity}`);
 await bridgeOp(p.ownerBridge.url,"expression",{operation:"open",document:p.expressionDocument,actor:"human:sf4-owner"});
 const reopened=await bridgeOp(p.ownerBridge.url,"expression",{operation:"inspect",expression_ref:p.expressionRef});
 if(reopened.document?.revision!==p.expressionDocument.revision)throw new Error(`the restarted owner bridge did not reopen the disclosed Expression: ${JSON.stringify(reopened)}`);
}

async function ownerPage(page,p,run){
 const url=p.ownerBridge.url;
 const context=await page.context().browser().newContext();await context.addInitScript(value=>window.__OI_KERNEL_BRIDGE__=value,url);const owner=await context.newPage();await owner.goto(page.url().split("/").slice(0,3).join("/"));
 try{return await run(owner,url);}finally{await context.close();}
}

async function openWorld(page,worldRef,run){
 const enter=page.getByRole("button",{name:"O:I is ready. Open the app."});try{await enter.waitFor({state:"visible",timeout:30000});await enter.click();}catch{}
 const nav=page.getByRole("complementary",{name:"World navigator"});await nav.getByRole("button",{name:"Open Explore",exact:true}).click();
 const explore=page.getByRole("region",{name:"Explore"});try{await explore.locator('[data-field-state="available"]').waitFor({timeout:60000});}catch{throw new Error(`Explore did not become available: ${await page.locator("body").innerText()}`);}
 await explore.getByRole("searchbox",{name:"Search the open field"}).fill(run);await explore.getByRole("searchbox",{name:"Search the open field"}).press("Enter");
 await explore.locator(`.explore-results [data-explore-ref="${worldRef}"] button`).click();await explore.locator('.presentation-body[data-presentation-state="hosted"]').waitFor({timeout:60000});
 return explore;
}

function doorway(cradleRoot,env,request){
 const script=resolve(cradleRoot,"../../shared-field/spacetimedb/field.sh");
 let stdout="";try{stdout=execFileSync(script,{input:JSON.stringify(request),encoding:"utf8",env:{...process.env,...env},stdio:["pipe","pipe","ignore"],maxBuffer:64*1024*1024});}catch(error){stdout=error.stdout?.toString()??"";}
 const answer=JSON.parse(stdout);if(!answer.ok)throw new Error(`SharedField ${request.kind} refused: ${answer.error?.message}`);return answer.data;
}

export async function setup(args){
 const ownerSource=await sourceSetup(args);let readerSource;
 try{readerSource=await sourceSetup(args);}catch(error){ownerSource.cleanup();throw error;}
 const ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl",project="Editor",projectId="editor-walk";
 const as=token=>(action,input)=>{let raw="";try{raw=execFileSync(ctrl,["--root",ownerSource.root,"--json","action","run",action,JSON.stringify(input)],{encoding:"utf8",env:{...process.env,...ownerSource.env,CENTRAL_NATIVE_TOKEN:token}});}catch(error){raw=error.stdout?.toString()??"";}const result=JSON.parse(raw);if(!result.ok)throw new Error(`${action} refused: ${JSON.stringify(result.error??result)}`);return result.data;};
 const human=as(HUMAN_TOKEN),reader=as(READER_TOKEN);
 const relationsPath=join(ownerSource.root,"Control/relations/source-relations.json");mkdirSync(join(ownerSource.root,"Control/relations"),{recursive:true});
 let relations;try{relations=JSON.parse(readFileSync(relationsPath,"utf8"));}catch{relations={schema:"central.control.ground-relations/v1",project_id:"control:root",relations:[]};}
 const grants=[
  {principal_ref:"human:sf4-owner",actor_kind:"human",token_sha256:sha256(HUMAN_TOKEN),scope_refs:["control:root",`project:${projectId}`],actions:["central.document.create","central.document.mutate","central.receiving.submit","central.receiving.review","central.receiving.include","central.receiving.recover","central.day.ensure"],expires_at_unix_seconds:4000000000},
 ];
 const policies=[
  ["placement.json","work-placement-policy",{schema:"central.work-placement-policy/v1",scope_ref:"control:root",writable:[{path:"Work/Editor",class:"repository"}],enforcement:"native-actions",required_coverage:["file-content"],lease_seconds:300}],
  ["time.json","civil-time-policy",{schema:"central.civil-time-policy/v1",scope_ref:"control:root",timezone:"Europe/London",day_boundary_minutes:0,automatic_day_rollover:true}],
  ["authority.json","native-action-authority",{schema:"central.native-action-authority/v1",scope_ref:"control:root",grants}],
 ];
 for(const [name,role,value] of policies){const path=`Control/user/${name}`,ref=`central:source:control:root:${path}`;writeFileSync(join(ownerSource.root,path),JSON.stringify(value,null,2));if(!relations.relations.some(entry=>entry.ref===ref))relations.relations.push({ref,path,roles:[role],provenance:"human-adopted",standing:"architecture-contract",treatment:"projectcentral-user",recognition:"controlled-sf4-walk-fixture",recorded_at_unix_seconds:1});}
 writeFileSync(relationsPath,JSON.stringify(relations,null,2));
 const policy=as("")("central.work.policy",{project});
 const doc=human("central.document.create",{project,kind:"flow",document_id:"doc:sf4-return",title:"SF4 return source",expected_policy_revision:policy.revision,template_payload:{supplied:`Public opening. ${SENTINEL}`},fields:[{id:"sf4-field",label:"SF4 field",template_pointer:"/supplied"}]});
 const run=Date.now().toString(36),worldA=`world:sf4:${run}:a`,fieldA=`oi:field:sf4:${run}:a`,projectionRef=`projection:sf4:${run}:a`,participantA=`participant:sf4:${run}:a`,expressionRef=`expression:sf4-${run}`,participantB=`participant:sf4:${run}:b`;
 const repoRoot=resolve(args.cradleRoot,"../.."),ownerEnv={...ownerSource.env,OI_REPO_ROOT:repoRoot,OI_STATE_HOME:join(ownerSource.env.OI_HOME,"shared-field"),CENTRAL_NATIVE_TOKEN:HUMAN_TOKEN},env={...readerSource.env,OI_REPO_ROOT:repoRoot,OI_STATE_HOME:join(readerSource.env.OI_HOME,"shared-field"),CENTRAL_NATIVE_TOKEN:READER_TOKEN};
 const b=doorway(args.cradleRoot,env,{kind:"identity",token_label:"owner"});
 const a=doorway(args.cradleRoot,ownerEnv,{kind:"identity",token_label:"sf4-a"});
 const space=`central:wiki:project:sf4-${run}`,node=`wiki:node:sf4-${run}`;
 const reading={schema:"central.wiki-reading/v1",register:"project",project,world_ref:`project:${projectId}`,profile:"okf-wiki/v1",source:{path:doc.source.path,ref:doc.source.ref,revision:doc.revision.revision},spaces:[{ref:space,title:"SF4 disposable source",revision:1,anchor_ref:node,parent_space_refs:[],child_space_refs:[],node_refs:[node]}],nodes:[{ref:node,title:"SF4 return source",node_type:"document",revision:1,space_refs:[space],source_refs:[doc.source.path]}],relations:[{from_ref:space,kind:"space-node",to_ref:node}]};
 let bundle=projectCentralWikiWorld({readings:[reading],selection:{schema:"oi.central-wiki-selection/v1",world_ref:worldA,subject_world_ref:reading.world_ref,field_ref:fieldA,projection_ref:projectionRef,presentation_ref:`presentation:sf4:${run}`,title:`SF4 World A ${run}`,summary:"A disposable native document projected for a second world.",audience:{visibility:"public"},publisher:{participant_ref:participantA,identity_ref:"human:sf4-owner",chosen_name:"SF4 World A owner"},spaces:{[space]:"nodes"},node_refs:[node],disclose_source_refs:true},published_at:new Date().toISOString()});
 bundle=structuredClone(bundle);const worldPresentation=bundle.projection.representation.payload;worldPresentation.regions[0].bindings.push({schema:"oi.presentation-binding/v1",binding_ref:`binding:sf4-expression:${run}`,component_ref:"oi.presentation/expression/v1",portable_renderer:"oi.presentation/expression/v1",subject_ref:doc.source.ref,props:{expression:{schema:"oi.expression-presentation/v1",expression_ref:expressionRef,expression_revision:1,scene_ref:`${expressionRef}:scene:main`,live_renderer_ref:"renderer:oi:expression-stage",live_availability:"available",subjects:[],representations:[]},composition:{schema:"oi.expression/v1",expression_ref:expressionRef,revision:1,title:"SF4 returned Expression",scenes:[{scene_ref:`${expressionRef}:scene:main`,revision:1,title:"Main",entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:`${expressionRef}:scene:main`,entity_ref:null},provenance:[],representations:[],refinements:[]}},fallback:{title:"SF4 returned Expression"},provenance:[{kind:"expression",ref:expressionRef,source_system:"o-i",revision:"1"}]});
 const argsA=hostedPublicationArgs(bundle),worldEntry=argsA.putExploreEntries.find(entry=>entry.semanticRef===worldA);const entry=JSON.parse(worldEntry.entryJson);entry.meta={...(entry.meta??{}),document_id:doc.document_id,project,projection_ref:projectionRef,owner_identity_ref:"human:sf4-owner",source_anchors:[]};worldEntry.entryJson=JSON.stringify(entry);
 if(publicationSentinelLeaks({bundle,argsA},[SENTINEL]).length)throw new Error("private sentinel entered the outward Projection");
 // The disclosed Expression exists in the owner's native application before
 // its inspected composition is projected. The hosted document is a reading,
 // never the source from which EX1 ownership is reconstructed. A throwaway
 // bridge creates it; the exact document carries it across publication, and
 // the living owner bridge reopens it below.
 const seedBridge=await startOwnerBridge(args.cradleRoot,ownerEnv);
 try{
  await bridgeOp(seedBridge.url,"expression",{operation:"create",expression_ref:expressionRef,title:"SF4 returned Expression",actor:"human:sf4-owner"});
  var nativeExpression=await bridgeOp(seedBridge.url,"expression",{operation:"inspect",expression_ref:expressionRef});
 }finally{seedBridge.stop();}
 if(nativeExpression.document?.revision!==1)throw new Error(`native owner Expression basis was not created and inspected: ${JSON.stringify(nativeExpression)}`);
 const expressionDocument=nativeExpression.document;
 const expressionBinding=worldPresentation.regions[0].bindings.at(-1);expressionBinding.props.composition=nativeExpression.document;
 expressionBinding.props.expression.expression_revision=nativeExpression.document.revision;
 const finalArgsA=hostedPublicationArgs(bundle),finalWorldEntry=finalArgsA.putExploreEntries.find(entry=>entry.semanticRef===worldA),finalEntry=JSON.parse(finalWorldEntry.entryJson);finalEntry.meta={...(finalEntry.meta??{}),document_id:doc.document_id,project,projection_ref:projectionRef,owner_identity_ref:"human:sf4-owner",source_anchors:[]};finalWorldEntry.entryJson=JSON.stringify(finalEntry);
 doorway(args.cradleRoot,ownerEnv,{kind:"publish",token_label:"sf4-a",args:finalArgsA});
 const participant=createParticipant({participant_ref:participantB,field_ref:fieldA,identity:{kind:"agent",ref:"agent:sf4-world-b"},presentation:{world_ref:`world:sf4:${run}:b`,chosen_name:"SF4 World B"},provenance:{source_system:"central",source_revision:"world-b@1",source_ref:"central:source:sf4-world-b"}});
 doorway(args.cradleRoot,ownerEnv,{kind:"participant",token_label:"sf4-a",participant,target_identity:b.transport_identity,role:"contributor",contactable:true});
 // One living owner bridge for the whole scenario, started only after the
 // field, world and publisher exist so its first snapshot holds them: the
 // kernel keeps open Expressions in process memory, and the owner's native
 // state must stay in one process exactly as the owner's real app does.
 const ownerBridge=await startOwnerBridge(args.cradleRoot,ownerEnv);
 const bridgeIdentity=(await bridgeOp(ownerBridge.url,"shared_field",{kind:"identity"})).transport_identity;
 if(bridgeIdentity!==a.transport_identity){ownerBridge.stop();throw new Error(`owner bridge identity mismatch: expected ${a.transport_identity}, got ${bridgeIdentity}`);}
 await bridgeOp(ownerBridge.url,"expression",{operation:"open",document:expressionDocument,actor:"human:sf4-owner"});
 const reopened=await bridgeOp(ownerBridge.url,"expression",{operation:"inspect",expression_ref:expressionRef});
 if(reopened.document?.revision!==1)throw new Error(`the living owner bridge did not reopen the disclosed Expression: ${JSON.stringify(reopened)}`);
 return {...readerSource,env,ownerEnv,ownerRoot:ownerSource.root,readerRoot:readerSource.root,cradleRoot:args.cradleRoot,human,reader,doc,bundle,argsA:finalArgsA,run,worldA,fieldA,projectionRef,participantA,participantB,expressionRef,ownerIdentity:a.transport_identity,ownerBridge,expressionDocument,doorway:request=>doorway(args.cradleRoot,env,request),ownerDoorway:request=>doorway(args.cradleRoot,ownerEnv,request),cleanup:()=>{ownerBridge.stop();readerSource.cleanup();ownerSource.cleanup();}};
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}){
 check(p.ownerRoot!==p.readerRoot&&p.ownerEnv.OI_HOME!==p.env.OI_HOME,"Owner A and contributor B use independent native Central roots and application homes");
 const bridgeUrl=`http://127.0.0.1:${process.env.WALK_BRIDGE_PORT??4284}`;
 await page.goto(baseUrl);await channel("info");
 const explore=await openWorld(page,p.worldA,p.run);
 const body=explore.locator('.presentation-body[data-presentation-state="hosted"]');await body.waitFor({timeout:60000});
 check(await body.getAttribute("data-source-revision")===p.doc.revision.revision,"World B encounters the disposable Central document at its exact source revision");
 const panel=explore.getByRole("complementary",{name:"Contributions"});await panel.getByRole("button",{name:"Contribute"}).click();
 const returned="World B returns a concrete difference through the ordinary composer.";await panel.getByLabel("Contributed material").fill(returned);await panel.getByRole("button",{name:"Submit Contribution"}).click();
 await panel.locator('[role="status"],[role="alert"]').waitFor({timeout:45000});const submitMessage=await panel.locator('[role="status"],[role="alert"]').innerText();if(!submitMessage.includes("quarantined"))throw new Error(`composer submit failed: ${submitMessage}`);check(submitMessage.includes("quarantined"),"The new composer submits through the hosted reducer and receives quarantine");
 const contributionRef=submitMessage.match(/Contribution (contribution:[^ ]+) quarantined/)?.[1];if(!contributionRef)throw new Error(`composer did not disclose its Contribution ID: ${submitMessage}`);const receipt=p.doorway({kind:"receipt",token_label:"owner",contribution_ref:contributionRef});check(receipt.state==="quarantined"&&receipt.field_ref===p.fieldA,"World B reads its own authoritative quarantine receipt");
 const bView=p.doorway({kind:"read",token_label:"owner",ref:p.worldA}),aView=p.ownerDoorway({kind:"read",token_label:"sf4-a",ref:p.worldA});check((bView.owner_pending_contributions??[]).length===0&&(aView.owner_pending_contributions??[]).some(row=>row.ingress_ref===receipt.ingress_ref),"Pending ingress is visible only to the owning identity");
 await ownerPage(page,p,async (owner,bridgeUrl)=>{const wire=await (await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op:"shared_field",request:{kind:"read",ref:p.worldA}})})).json();if(!wire?.outcome?.data?.owner_pending_contributions?.some(row=>row.ingress_ref===receipt.ingress_ref))throw new Error("owner bridge exact read did not contain the expected pending ingress");const ownerExplore=await openWorld(owner,p.worldA,p.run);const pending=ownerExplore.locator(`[data-pending-ingress="${receipt.ingress_ref}"]`);for(let cycle=0;cycle<3&&await pending.count()===0;cycle++){
    for(let attempt=0;attempt<6&&await pending.count()===0;attempt++){await ownerExplore.getByRole("button",{name:"Refresh the field"}).click();await owner.waitForTimeout(2000);}
    if(await pending.count()===0){await restartOwnerBridge(p);}
   }
   await pending.waitFor({timeout:60000});const inspected=await pending.innerText();check(inspected.includes(returned)&&inspected.includes("Inspect exact contribution and basis"),"The owner UI exposes the contributed prose and exact attached basis before deciding");await pending.getByRole("button",{name:"Admit Contribution"}).click();await pending.waitFor({state:"detached",timeout:30000});});
 const admitted=p.doorway({kind:"receipt",token_label:"owner",contribution_ref:contributionRef});check(admitted.state==="admitted","The owner admitted the Contribution through the ordinary owner UI");
 await explore.getByRole("button",{name:"Refresh the field"}).click();await panel.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`).waitFor({timeout:30000});
 check((await panel.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`).innerText()).includes(returned),"The admitted Contribution appears in contextual history with its own identity");
 const admittedContract=p.ownerDoorway({kind:"read",token_label:"sf4-a",ref:p.worldA}).contributions.find(item=>item.contribution_ref===admitted.contribution_ref)?.contract;
 if(!admittedContract)throw new Error("owner reading lost the admitted Contribution contract");
 const staleSubmission=nativeReturnSubmission(admittedContract,{source_ref:p.doc.source.ref,source_revision:p.doc.revision.revision,projection_ref:p.projectionRef,projection_revision:1,world_presentation_ref:`presentation:sf4:${p.run}`,world_presentation_revision:1,expression_ref:p.expressionRef,expression_revision:1},{project:"Editor",document_id:p.doc.document_id,producer_key:`shared-field:${admitted.contribution_ref}:stale-refusal`});
 const stalePending=p.human(staleSubmission.action_ref,staleSubmission.input).record;
 check(stalePending.status==="pending"&&stalePending.proposed_source_revision===p.doc.revision.revision,"Owner A brokers a second exact native Return while the contributed basis is current");
 const oldSubmit=submitMessage;await panel.getByRole("button",{name:"Contribute"}).click();await panel.getByLabel("Kind").selectOption("expression-scene");await panel.getByLabel("Difference summary").fill("Add a scene returned by World B.");await panel.getByLabel("Scene title").fill("Returned scene");await panel.getByRole("button",{name:"Submit Contribution"}).click();await page.waitForFunction(({old})=>{const text=document.querySelector('.explore-contributions [role="status"]')?.textContent??"";return text.includes("quarantined")&&text!==old;},{old:oldSubmit},{timeout:45000});const expressionMessage=await panel.locator('[role="status"]').innerText(),expressionContributionRef=expressionMessage.match(/Contribution (contribution:[^ ]+) quarantined/)?.[1];if(!expressionContributionRef)throw new Error(`Expression Contribution ID missing: ${expressionMessage}`);const expressionReceipt=p.doorway({kind:"receipt",token_label:"owner",contribution_ref:expressionContributionRef});
 await ownerPage(page,p,async (owner,ownerBridge)=>{const basis=await bridgeOp(ownerBridge,"expression",{operation:"inspect",expression_ref:p.expressionRef});if(basis.document?.revision!==1)throw new Error(`native Expression owner did not retain the disclosed basis: ${JSON.stringify(basis)}`);const wire=await bridgeOp(ownerBridge,"shared_field",{kind:"read",ref:p.worldA});if(!wire?.owner_pending_contributions?.some(row=>row.ingress_ref===expressionReceipt.ingress_ref))throw new Error("owner bridge did not read the Expression ingress");const ownerExplore=await openWorld(owner,p.worldA,p.run),pending=ownerExplore.locator(`[data-pending-ingress="${expressionReceipt.ingress_ref}"]`);await pending.waitFor({timeout:60000});await pending.getByRole("button",{name:"Admit Contribution"}).click();await owner.waitForTimeout(2000);await ownerExplore.getByRole("button",{name:"Refresh the field"}).click();const expressionRow=ownerExplore.locator(`[data-contribution-ref="${expressionContributionRef}"]`);await expressionRow.waitFor({timeout:30000});await expressionRow.getByRole("button",{name:"Return to source"}).click();const acceptExpression=ownerExplore.getByRole("button",{name:"Accept Expression return"});await acceptExpression.waitFor({timeout:30000});check((await acceptExpression.locator('xpath=..').innerText()).includes("expression")&&(await acceptExpression.locator('xpath=..').innerText()).includes("proposal"),"The owner UI exposes the exact native Expression proposal before review");await acceptExpression.click();await owner.waitForTimeout(2000);const document=(await bridgeOp(ownerBridge,"expression",{operation:"inspect",expression_ref:p.expressionRef})).document;check(document?.revision===3&&document.scenes.some(scene=>scene.title==="Returned scene")&&document.refinements.some(refinement=>refinement.decision?.state==="accepted"),"The UI-generated scene passed through real native EX1 propose/review and changed the Expression revision");});
 await explore.getByRole("button",{name:"Refresh the field"}).click();
 // Only the owner's world holds the source, so returning the admitted
 // Contribution to its source is an owner act in the owner's own panel.
 await ownerPage(page,p,async owner=>{const ownerExplore=await openWorld(owner,p.worldA,p.run);const returnRow=ownerExplore.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`);await returnRow.waitFor({timeout:60000});await returnRow.getByRole("button",{name:"Return to source"}).click();const returnNotice=ownerExplore.locator('.explore-contributions [role="status"],.explore-contributions [role="alert"]');await returnNotice.waitFor({timeout:30000});const returnText=await returnNotice.innerText();if(!returnText.includes("Returned to the native owner for review."))throw new Error(`native Return failed: ${returnText}`);});
 const listed=p.human("central.receiving.list",{project:"Editor",after:0,limit:200}),row=listed.returns.filter(item=>item.document_id===p.doc.document_id&&item.source_ref===p.doc.source.ref).at(-1);check(row?.status==="pending"&&row.task_ref===p.projectionRef,"The owner UI returned the admitted material to Central's real receiving field");
 await ownerPage(page,p,async owner=>{const ownerExplore=await openWorld(owner,p.worldA,p.run),native=ownerExplore.locator(`[data-native-return="${row.return_ref}"]`);await native.waitFor({timeout:60000});const inspected=await native.innerText();check(inspected.includes(row.return_ref)&&inspected.includes(p.doc.source.ref),"The owner UI discovers and inspects the exact native Return and source basis");await native.getByRole("button",{name:"Accept native Return"}).click();await owner.waitForTimeout(3000);});
 const advanced=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});const accepted=p.human("central.receiving.read",{project:"Editor",return_ref:row.return_ref});check(accepted.record.status==="included","The native owner UI completed the exact Return through native review/include");check(advanced.revision.revision!==p.doc.revision.revision,"Native inclusion advanced the source revision");
 await ownerPage(page,p,async owner=>{const ownerExplore=await openWorld(owner,p.worldA,p.run),stale=ownerExplore.locator(`[data-native-return="${stalePending.return_ref}"]`);await stale.waitFor({timeout:60000});check((await stale.innerText()).includes(p.doc.revision.revision),"The owner UI retains the stale native Return and its proposed source revision for an explicit decision");await stale.getByRole("button",{name:"Refuse native Return"}).click();await stale.waitFor({state:"detached",timeout:30000});});
 const refusedStale=p.human("central.receiving.read",{project:"Editor",return_ref:stalePending.return_ref});check(refusedStale.record.status==="rejected"&&p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id}).revision.revision===advanced.revision.revision,"Refusing a stale native Return remains authoritative and does not mutate the advanced source");
 const p1=p.bundle.projection,presentation=worldPresentationFromProjection(p1),p2=reviseProjection(p1,{source_revision:advanced.revision.revision,published_at:new Date().toISOString(),representation:{kind:"oi.world-presentation/v1",payload:{...presentation,revision:presentation.revision+1,summary:returned}},provenance:[...p1.provenance,{kind:"accepted-return",ref:admitted.contribution_ref,source_system:"central",revision:advanced.revision.revision}]});
 const args2={...p.argsA,putProjection:{...p.argsA.putProjection,projectionKey:`${p2.projection_ref}@${p2.projection_revision}`,projectionRevision:p2.projection_revision,sourceRevision:p2.source.revision,state:p2.state,contractJson:JSON.stringify(p2)},putExploreEntries:[],putExploreRelations:[]};p.ownerDoorway({kind:"publish",token_label:"sf4-a",args:args2});
	 await explore.getByRole("button",{name:"Refresh the field"}).click({force:true});await page.waitForFunction((revision)=>document.querySelector('.presentation-body[data-presentation-state="hosted"]')?.getAttribute("data-source-revision")===revision,advanced.revision.revision,{timeout:30000});
 check((await body.innerText()).includes(returned),"After explicit reprojection, World B sees the accepted returned difference and advanced source revision");
 await ownerPage(page,p,async owner=>{const ownerExplore=await openWorld(owner,p.worldA,p.run);const staleRow=ownerExplore.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`);await staleRow.waitFor({timeout:60000});await staleRow.getByRole("button",{name:"Return to source"}).click();const staleAlert=ownerExplore.locator('.explore-contributions [role="alert"]');await staleAlert.waitFor({timeout:30000});check((await staleAlert.innerText()).includes("basis is stale"),"The native Return path refuses the old Contribution after source and Projection revisions advance");});
 await panel.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`).getByRole("button",{name:"Respond"}).click();const refusedText="World B offers a second difference for explicit refusal.";await panel.getByLabel("Contributed material").fill(refusedText);await panel.getByRole("button",{name:"Submit Contribution"}).click();await panel.getByText(/quarantined/).waitFor({timeout:30000});const refusedMessage=await panel.locator('[role="status"]').innerText(),refusedRef=refusedMessage.match(/Contribution (contribution:[^ ]+) quarantined/)?.[1];if(!refusedRef)throw new Error(`second contribution ID missing: ${refusedMessage}`);const refusedReceipt=p.doorway({kind:"receipt",token_label:"owner",contribution_ref:refusedRef});

 const admittedRow=panel.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`);await admittedRow.getByRole("button",{name:"Withdraw"}).click();await page.waitForTimeout(3000);const withdrawn=p.doorway({kind:"receipt",token_label:"owner",contribution_ref:admitted.contribution_ref});check(withdrawn.state==="withdrawn","The contributor can withdraw its own admitted Contribution through the ordinary UI");
 await ownerPage(page,p,async (owner,bridgeUrl)=>{const wire=await (await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op:"shared_field",request:{kind:"read",ref:p.worldA}})})).json();if(!wire?.outcome?.data?.owner_pending_contributions?.some(row=>row.ingress_ref===refusedReceipt.ingress_ref))throw new Error("owner bridge exact read did not contain the refused pending ingress");const ownerExplore=await openWorld(owner,p.worldA,p.run);const pending=ownerExplore.locator(`[data-pending-ingress="${refusedReceipt.ingress_ref}"]`);for(let cycle=0;cycle<3&&await pending.count()===0;cycle++){
    for(let attempt=0;attempt<6&&await pending.count()===0;attempt++){await ownerExplore.getByRole("button",{name:"Refresh the field"}).click();await owner.waitForTimeout(2000);}
    if(await pending.count()===0){await restartOwnerBridge(p);}
   }
   await pending.waitFor({timeout:60000});await pending.locator("details summary").click();const inspectedResponse=await pending.innerText();check(inspectedResponse.includes(refusedText)&&inspectedResponse.includes(admitted.contribution_ref),"The owner inspects the Contribution-on-Contribution response before refusal");await pending.getByRole("button",{name:"Refuse Contribution"}).click();await pending.waitFor({state:"detached",timeout:30000});});
 check(p.doorway({kind:"receipt",token_label:"owner",contribution_ref:refusedRef}).state==="rejected","The owner refusal is authoritative and visible to the submitter");
 const p3=withdrawProjection(p2,{published_at:new Date().toISOString(),reason:"SF4 run complete"});const args3={...args2,putProjection:{...args2.putProjection,projectionKey:`${p3.projection_ref}@${p3.projection_revision}`,projectionRevision:p3.projection_revision,state:p3.state,contractJson:JSON.stringify(p3)}};p.ownerDoorway({kind:"publish",token_label:"sf4-a",args:args3});
 const final=p.doorway({kind:"read",token_label:"owner",ref:p.worldA});
 // The read model holds the CURRENT projection at its stable ref: withdrawal
 // supersedes rather than erases, and the withdrawn state is disclosed.
 const current=final.projections.find(row=>row.projection_ref===p2.projection_ref);
 check(current?.state==="withdrawn"&&current.projection_revision===3,"World B's real hosted read shows the withdrawal as authoritative at the stable projection ref");
 check(!JSON.stringify(final).includes(SENTINEL),"The withdrawn world's hosted read excludes the private sentinel");
 await shot("sf4-contribution-return");
}
