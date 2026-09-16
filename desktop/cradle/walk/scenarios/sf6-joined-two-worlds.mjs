import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setup as sourceSetup} from "./editor.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {createParticipant,reviseProjection,withdrawProjection} from "../../../../shared-field/index.mjs";
import {worldPresentationFromProjection} from "../../../../shared-field/presentation-projection.mjs";
import {projectCentralWikiWorld,hostedPublicationArgs,publicationSentinelLeaks} from "../../../../shared-field/central-wiki-projection.mjs";
import {createKnowledgeEncounter} from "../../../../shared-field/knowledge-encounter.mjs";
import {validateNaraCueExpression,createNaraPresenceConsent,projectNaraExpression,hostedNaraExpressionArgs,withdrawNaraProjection} from "../../../../shared-field/nara-expression-projection.mjs";
import {validateExpressionComposition} from "../../../../shared-field/expression-projection.mjs";
import {beingEncounter,invocationStanding} from "../../../../desktop/cradle/src/explore/being.mjs";

// SF6 — joined two-world lived acceptance (Wayfinder §10/§11): the canonical
// 17-step journey over ONE hosted SharedField on the second machine, with two
// independently grounded worlds, across three subjects (authored document,
// safe Nara presentation, QL/Bimba object). Check labels name their step.

const HUMAN_TOKEN="sf6-owner-native-credential-for-joined-acceptance";
const READER_TOKEN="sf6-second-world-native-credential-for-joined-acceptance";
const SENTINEL="SF6_PRIVATE_SENTINEL_NEVER_PROJECT";
const NARA_SENTINELS=['bioquaternion','resonance','journal','activity body','particle','GPU','Agent context'];
const OWNER_BRIDGE_PORT=4287;
const sha256=value=>createHash("sha256").update(value).digest("hex");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function bridgeOp(url,op,request){
 const envelope=await (await fetch(`${url}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op,request})})).json();
 if(envelope.error||envelope.outcome?.failure)throw new Error(`${op} failed: ${JSON.stringify(envelope.error??envelope.outcome?.failure??envelope)}`);
 return envelope.outcome?.data;
}

async function startOwnerBridge(cradleRoot,ownerEnv){
 // Fixed port: the scenario stops its own bridge before starting another, so
 // the browser's stable bridge URL survives an owner-connection restart. A
 // leaked bridge from a failed earlier run would answer readiness with the
 // wrong identity, so the port is cleared first.
 try{for(const pid of execFileSync("lsof",["-ti",`tcp:${OWNER_BRIDGE_PORT}`,"-sTCP:LISTEN"],{encoding:"utf8"}).split("\n").filter(Boolean).map(Number))if(pid!==process.pid)try{process.kill(pid,"SIGTERM");}catch{}}catch{}
 await sleep(300);
 const child=spawn("cargo",["run","--quiet","--manifest-path",join(cradleRoot,"kernel/Cargo.toml"),"--bin","walk-bridge","--",`127.0.0.1:${OWNER_BRIDGE_PORT}`],{cwd:cradleRoot,detached:true,stdio:["ignore","pipe","pipe"],env:{...process.env,...ownerEnv,OI_SHARED_FIELD_TOKEN_LABEL:"sf6-a",CENTRAL_NATIVE_TOKEN:HUMAN_TOKEN}});
 let output="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);
 const stop=()=>{try{process.kill(-child.pid,"SIGTERM");}catch{child.kill("SIGTERM");}};
 const url=`http://127.0.0.1:${OWNER_BRIDGE_PORT}`;
 const deadline=Date.now()+180000;
 for(;;){
  if(child.exitCode!==null){stop();throw new Error(`owner bridge exited before readiness (${child.exitCode}): ${output}`);}
  try{if((await fetch(`${url}/state`)).ok)break;}catch{}
  if(Date.now()>deadline){stop();throw new Error(`owner bridge did not start: ${output}`);}
  await sleep(100);}
 return {url,stop};
}

function doorway(cradleRoot,env,request){
 const script=resolve(cradleRoot,"../../shared-field/spacetimedb/field.sh");
 let stdout="";
 try{stdout=execFileSync(script,{input:JSON.stringify(request),encoding:"utf8",env:{...process.env,...env},stdio:["pipe","pipe","ignore"],maxBuffer:64*1024*1024});}
 catch(error){stdout=error.stdout?.toString()??"";}
 const answer=JSON.parse(stdout);if(!answer.ok)throw new Error(`SharedField ${request.kind} refused: ${answer.error?.message}`);return answer.data;
}

/** The authored safe Nara scene: eight neutral QL-owned loci, exactly as the
 * validator defines them — glyph and layout only, no protected state. */
function naraSafeCueDocument(expressionRef){
 const loci=[...Array(7).keys()].map(ordinal=>({ordinal,title:`Centre ${ordinal+1}`,glyph:String(ordinal+1),y:-264+ordinal*88}));
 loci.push({ordinal:7,title:"EarthBody",glyph:"⊕",y:-376});
 const entities=Object.fromEntries(loci.map(({ordinal,title,glyph,y})=>[`${expressionRef}:entity:locus-${ordinal}`,{
  entity_ref:`${expressionRef}:entity:locus-${ordinal}`,revision:1,title,
  subject:{subject_ref:`ql:nara:focus:m4:${ordinal===7?"earth-body":`centre:${ordinal}`}`,native_owner:"ql",presentation_role:"thing",sources:[],readings:[],actions:[]},
  parameters:{glyph:{value:glyph,automation:null},x:{value:0,automation:null},y:{value:y,automation:null},scale:{value:1,automation:null}},
 }]));
 return {schema:"oi.expression/v1",expression_ref:expressionRef,revision:1,title:"Nara · safe cues",
  scenes:[{scene_ref:`${expressionRef}:scene:main`,revision:1,title:"Seven centres and EarthBody",entity_refs:Object.keys(entities)}],
  entities,relations:{},selection:{scene_ref:`${expressionRef}:scene:main`,entity_ref:null},
  provenance:[{ref:"ql:nara:focus:m4",revision:"1",availability:"unavailable"},{ref:"source:ql/nara-occasion",revision:"1",availability:"unavailable"}],
  representations:[],refinements:[]};
}

export async function setup(args){

 const ownerSource=await sourceSetup(args);console.log("  [sf6] setup: owner root ready");
 let readerSource;
 try{readerSource=await sourceSetup(args);}catch(error){ownerSource.cleanup();throw error;}

 const ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl",project="Editor",projectId="editor-walk";
 const as=token=>(action,input)=>{let raw="";try{raw=execFileSync(ctrl,["--root",ownerSource.root,"--json","action","run",action,JSON.stringify(input)],{encoding:"utf8",env:{...process.env,...ownerSource.env,CENTRAL_NATIVE_TOKEN:token}});}catch(error){raw=error.stdout?.toString()??"";}const result=JSON.parse(raw);if(!result.ok)throw new Error(`${action} refused: ${JSON.stringify(result.error??result)}`);return result.data;};
 const human=as(HUMAN_TOKEN);
 const relationsPath=join(ownerSource.root,"Control/relations/source-relations.json");mkdirSync(join(ownerSource.root,"Control/relations"),{recursive:true});
 let relations;try{relations=JSON.parse(readFileSync(relationsPath,"utf8"));}catch{relations={schema:"central.control.ground-relations/v1",project_id:"control:root",relations:[]};}
 const grants=[
  {principal_ref:"human:sf6-owner",actor_kind:"human",token_sha256:sha256(HUMAN_TOKEN),scope_refs:["control:root",`project:${projectId}`],actions:["central.document.create","central.document.mutate","central.receiving.submit","central.receiving.review","central.receiving.include","central.receiving.recover","central.day.ensure"],expires_at_unix_seconds:4000000000},
 ];
 const policies=[
  ["placement.json","work-placement-policy",{schema:"central.work-placement-policy/v1",scope_ref:"control:root",writable:[{path:"Work/Editor",class:"repository"}],enforcement:"native-actions",required_coverage:["file-content"],lease_seconds:300}],
  ["time.json","civil-time-policy",{schema:"central.civil-time-policy/v1",scope_ref:"control:root",timezone:"Europe/London",day_boundary_minutes:0,automatic_day_rollover:true}],
  ["authority.json","native-action-authority",{schema:"central.native-action-authority/v1",scope_ref:"control:root",grants}],
 ];
 for(const [name,role,value] of policies){const path=`Control/user/${name}`,ref=`central:source:control:root:${path}`;writeFileSync(join(ownerSource.root,path),JSON.stringify(value,null,2));if(!relations.relations.some(entry=>entry.ref===ref))relations.relations.push({ref,path,roles:[role],provenance:"human-adopted",standing:"architecture-contract",treatment:"projectcentral-user",recognition:"controlled-sf6-walk-fixture",recorded_at_unix_seconds:1});}
 writeFileSync(relationsPath,JSON.stringify(relations,null,2));
 // A real authored QL/Bimba object in the owner's ground: a QL working note
 // the joined whole cites at its exact revision.
 mkdirSync(join(ownerSource.root,"Work/Editor"),{recursive:true});
 const qlPath="Work/Editor/ql-bimba-note.md",qlBody="# Bimba working note (SF6 joined subject)\n\nSeven-centre basis with one distinct EarthBody; QL-owned, source-backed.\n";
 writeFileSync(join(ownerSource.root,qlPath),qlBody);
 const qlDoc=human("central.document.create",{project,kind:"flow",document_id:"doc:sf6-ql-note",title:"Bimba working note",expected_policy_revision:as("")("central.work.policy",{project}).revision,template_payload:{supplied:qlBody},fields:[{id:"bimba",label:"Bimba note",template_pointer:"/supplied"}]});
 const doc=human("central.document.create",{project,kind:"flow",document_id:"doc:sf6-return",title:"SF6 joined subject",expected_policy_revision:as("")("central.work.policy",{project}).revision,template_payload:{supplied:`Public opening. ${SENTINEL}`},fields:[{id:"sf6-field",label:"SF6 field",template_pointer:"/supplied"}]});
 const run=Date.now().toString(36),worldA=`world:sf6:${run}:a`,fieldA=`oi:field:sf6:${run}:a`,projectionRef=`projection:sf6:${run}:a`,participantA=`participant:sf6:${run}:a`,participantB=`participant:sf6:${run}:b`,expressionRef=`expression:sf6-${run}`,naraRef=`expression:sf6-nara-${run}`,qlNode=`wiki:node:sf6-${run}:ql`;
 const repoRoot=resolve(args.cradleRoot,"../.."),ownerEnv={...ownerSource.env,OI_REPO_ROOT:repoRoot,OI_STATE_HOME:join(ownerSource.env.OI_HOME,"shared-field"),CENTRAL_NATIVE_TOKEN:HUMAN_TOKEN},env={...readerSource.env,OI_REPO_ROOT:repoRoot,OI_STATE_HOME:join(readerSource.env.OI_HOME,"shared-field"),CENTRAL_NATIVE_TOKEN:READER_TOKEN};

 const b=doorway(args.cradleRoot,env,{kind:"identity",token_label:"owner"});console.log("  [sf6] setup: reader identity ready");
 const a=doorway(args.cradleRoot,ownerEnv,{kind:"identity",token_label:"sf6-a"});
 const space=`central:wiki:project:sf6-${run}`,node=`wiki:node:sf6-${run}`;
 const reading={schema:"central.wiki-reading/v1",register:"project",project,world_ref:`project:${projectId}`,profile:"okf-wiki/v1",
  source:{path:doc.source.path,ref:doc.source.ref,revision:doc.revision.revision},
  spaces:[{ref:space,title:"SF6 joined source",revision:1,anchor_ref:node,parent_space_refs:[],child_space_refs:[],node_refs:[node,qlNode]}],
  nodes:[
   {ref:node,title:"SF6 joined subject",node_type:"document",revision:1,space_refs:[space],source_refs:[doc.source.path]},
   {ref:qlNode,title:"Bimba working note",node_type:"document",revision:1,space_refs:[space],source_refs:[qlPath]},
  ],
  relations:[{from_ref:space,kind:"space-node",to_ref:node},{from_ref:space,kind:"space-node",to_ref:qlNode}]};
 let bundle=projectCentralWikiWorld({readings:[reading],selection:{schema:"oi.central-wiki-selection/v1",world_ref:worldA,subject_world_ref:reading.world_ref,field_ref:fieldA,projection_ref:projectionRef,presentation_ref:`presentation:sf6:${run}`,title:`SF6 World A ${run}`,summary:"A joined two-world acceptance subject.",audience:{visibility:"public"},publisher:{participant_ref:participantA,identity_ref:"human:sf6-owner",chosen_name:"SF6 World A owner"},spaces:{[space]:"nodes"},node_refs:[node,qlNode],disclose_source_refs:true},published_at:new Date().toISOString()});
 bundle=structuredClone(bundle);
 const worldPresentation=bundle.projection.representation.payload;
 worldPresentation.regions[0].bindings.push({schema:"oi.presentation-binding/v1",binding_ref:`binding:sf6-expression:${run}`,component_ref:"oi.presentation/expression/v1",portable_renderer:"oi.presentation/expression/v1",subject_ref:doc.source.ref,props:{expression:{schema:"oi.expression-presentation/v1",expression_ref:expressionRef,expression_revision:1,scene_ref:`${expressionRef}:scene:main`,live_renderer_ref:"renderer:oi:expression-stage",live_availability:"available",subjects:[{ref:doc.source.ref,revision:doc.revision.revision,availability:"available",sources:[{ref:doc.source.ref,revision:doc.revision.revision,availability:"available"}]}],representations:[]},composition:{schema:"oi.expression/v1",expression_ref:expressionRef,revision:1,title:"SF6 joined Expression",scenes:[{scene_ref:`${expressionRef}:scene:main`,revision:1,title:"Main",entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:`${expressionRef}:scene:main`,entity_ref:null},provenance:[],representations:[],refinements:[]}},fallback:{title:"SF6 joined Expression"},provenance:[{kind:"expression",ref:expressionRef,source_system:"o-i",revision:"1"}]});
 const worldEntry=hostedPublicationArgs(bundle).putExploreEntries.find(entry=>entry.semanticRef===worldA);
 const entry=JSON.parse(worldEntry.entryJson);entry.meta={...(entry.meta??{}),document_id:doc.document_id,project,projection_ref:projectionRef,owner_identity_ref:"human:sf6-owner",source_anchors:[]};worldEntry.entryJson=JSON.stringify(entry);
 if(publicationSentinelLeaks({bundle,argsA:hostedPublicationArgs(bundle)},[SENTINEL]).length)throw new Error("private sentinel entered the outward Projection");
 // The disclosed Expression exists in the owner's native application before
 // its inspected composition is projected; a throwaway bridge creates it and
 // the exact document carries it across publication.

 const seedBridge=await startOwnerBridge(args.cradleRoot,ownerEnv);console.log("  [sf6] setup: seed bridge up");
 try{
  await bridgeOp(seedBridge.url,"expression",{operation:"create",expression_ref:expressionRef,title:"SF6 joined Expression",actor:"human:sf6-owner"});
  var nativeExpression=await bridgeOp(seedBridge.url,"expression",{operation:"inspect",expression_ref:expressionRef});
 }finally{seedBridge.stop();}
 if(nativeExpression.document?.revision!==1)throw new Error(`native owner Expression basis was not created: ${JSON.stringify(nativeExpression)}`);
 const expressionDocument=nativeExpression.document;
 const expressionBinding=worldPresentation.regions[0].bindings.at(-1);
 expressionBinding.props.composition=expressionDocument;
 expressionBinding.props.expression.expression_revision=expressionDocument.revision;
 const finalArgsA=hostedPublicationArgs(bundle);
 const finalWorldEntry=finalArgsA.putExploreEntries.find(entry=>entry.semanticRef===worldA);
 const finalEntry=JSON.parse(finalWorldEntry.entryJson);finalEntry.meta={...(finalEntry.meta??{}),document_id:doc.document_id,project,projection_ref:projectionRef,owner_identity_ref:"human:sf6-owner",source_anchors:[]};finalWorldEntry.entryJson=JSON.stringify(finalEntry);
 // Hosted on the SECOND machine (frank-acceptance): the two-machine grade.
 const published=doorway(args.cradleRoot,ownerEnv,{kind:"publish",token_label:"sf6-a",args:finalArgsA});
 const participant=createParticipant({participant_ref:participantB,field_ref:fieldA,identity:{kind:"agent",ref:"agent:sf6-world-b"},presentation:{world_ref:`world:sf6:${run}:b`,chosen_name:"SF6 World B",summary:"The second world's own Agent presence.",presence:"exploring"},agency:{ref:"agent:sf6-world-b",source_system:"central",method_refs:[]},provenance:{source_system:"central",source_revision:"world-b@1",source_ref:"central:source:sf6-world-b"}});
 doorway(args.cradleRoot,ownerEnv,{kind:"participant",token_label:"sf6-a",participant,target_identity:b.transport_identity,role:"contributor",contactable:true});
 // The one living owner bridge, after the field exists, reopening the exact
 // disclosed Expression.

 const ownerBridge=await startOwnerBridge(args.cradleRoot,ownerEnv);console.log("  [sf6] setup: owner bridge up");
 process.once("exit",()=>ownerBridge.stop());
 for(const signal of ["SIGINT","SIGTERM"])process.once(signal,()=>{try{ownerBridge.stop();}catch{}process.exit(130);});
 const bridgeIdentity=(await bridgeOp(ownerBridge.url,"shared_field",{kind:"identity"})).transport_identity;
 if(bridgeIdentity!==a.transport_identity){ownerBridge.stop();throw new Error(`owner bridge identity mismatch: expected ${a.transport_identity}, got ${bridgeIdentity}`);}
 await bridgeOp(ownerBridge.url,"expression",{operation:"open",document:expressionDocument,actor:"human:sf6-owner"});
 return {...readerSource,env,ownerEnv,ownerRoot:ownerSource.root,readerRoot:readerSource.root,cradleRoot:args.cradleRoot,human,doc,qlDoc,bundle,argsA:finalArgsA,published,run,worldA,fieldA,projectionRef,participantA,participantB,expressionRef,naraRef,qlNode,expressionDocument,ownerIdentity:a.transport_identity,human,ownerBridge,doorway:request=>doorway(args.cradleRoot,env,request),ownerDoorway:request=>doorway(args.cradleRoot,ownerEnv,request),cleanup:()=>{ownerBridge.stop();readerSource.cleanup();ownerSource.cleanup();}};
}

async function ownerPage(page,p,run){
 // A fresh owner connection for every owner session: the page boots against
 // a bridge whose hosted snapshot is current, and no restart races a live page.
 await restartOwnerBridge(p);
 const url=p.ownerBridge.url;
 const context=await page.context().browser().newContext();
 await context.addInitScript(value=>window.__OI_KERNEL_BRIDGE__=value,url);
 const owner=await context.newPage();
 await owner.goto(page.url().split("/").slice(0,3).join("/"));
 try{return await run(owner,url);}finally{await context.close();}
}

async function openWorld(page,worldRef,run,root){
 const enter=page.getByRole("button",{name:"O:I is ready. Open the app."});try{await enter.waitFor({state:"visible",timeout:30000});await enter.click();}catch{}
 const chooser=page.getByRole("region",{name:"Central location"});
 if(root&&await chooser.isVisible().catch(()=>false))await bindDefaultCentral(page,root);
 const nav=page.getByRole("complementary",{name:"World navigator"});
 try{await nav.getByRole("button",{name:"Open Explore",exact:true}).click({timeout:15000});}
 catch(error){throw new Error(`Open Explore unavailable: ${(await page.locator("body").innerText().catch(()=>"")).slice(0,600)}`);}
 const explore=page.getByRole("region",{name:"Explore"});try{await explore.locator('[data-field-state="available"]').waitFor({timeout:60000});}catch{throw new Error(`Explore did not become available: ${await page.locator("body").innerText()}`);}
 await explore.getByRole("searchbox",{name:"Search the open field"}).fill(run);await explore.getByRole("searchbox",{name:"Search the open field"}).press("Enter");
 await explore.locator(`.explore-results [data-explore-ref="${worldRef}"] button`).click();await explore.locator('.presentation-body[data-presentation-state="hosted"]').waitFor({timeout:60000});
 return explore;
}

export default async function run({page,baseUrl,check,shot,channel,provision:p}){
 check(p.ownerRoot!==p.readerRoot&&p.ownerEnv.OI_HOME!==p.env.OI_HOME,"[2machines|worlds] Owner A and the second world are independently grounded");
 check(p.published.target.database.includes("acceptance")&&!p.published.target.uri.startsWith("ws://127.0.0.1"),"[6] The joined field is hosted on the second-machine acceptance service",{target:p.published.target.name,uri:p.published.target.uri});
 const hostedRow=p.published.hosted_projection_row;
 check(hostedRow.projectionRef===p.projectionRef&&hostedRow.projectionRevision===1&&hostedRow.sourceRevision===p.doc.revision.revision,"[6] The hosted Projection row carries the exact projection and source revision");
 // Steps 1-5 already stand in the provision: authored document, bounded wiki
 // whole, native Expression revision 1, exact composition, audience-filtered
 // publication. Step 7: the second world discovers and opens it.
 await page.goto(baseUrl);await channel("info");
 const explore=await openWorld(page,p.worldA,p.run);
 const body=explore.locator('.presentation-body[data-presentation-state="hosted"]');await body.waitFor({timeout:60000});
 check(await body.getAttribute("data-source-revision")===p.doc.revision.revision,"[7] The second world encounters the subject at its exact source revision");
 // Step 8: live Expression or explicit fallback.
 const expressionEl=body.locator("[data-expression-state]").first();
 const expressionState=await expressionEl.getAttribute("data-expression-state").catch(()=>null);
 check(["live","fallback","unavailable"].includes(expressionState??"")&&(await expressionEl.innerText().catch(()=>"")).includes("SF6 joined Expression"),"[8] The second world enters the live Expression or its explicit safe fallback",{state:expressionState});
 // Step 9: provenance inspection and bounded knowledge recentering. The
 // bounded whole is the encounter the app itself computes from the open
 // reading; the QL node enters it through the disclosed relation.
 const bRead=p.doorway({kind:"read",ref:p.worldA});
 const whole=createKnowledgeEncounter({resource:bRead.entry,relations:bRead.neighbourhood?.relations??{error:"the open reading carried no relation view"},actions:bRead.neighbourhood?.actions??[],sources:{ref:bRead.entry.ref,revision:bRead.entry.revision,provenance:bRead.entry.provenance}});
 check(whole.state==="available"&&whole.nodes.length<=24&&whole.edges.length<=48,"[9] The knowledge encounter is a bounded local whole",{nodes:whole.nodes?.length,edges:whole.edges?.length});
 // Step 17b: select the Bimba/QL object itself and encounter it as its own
 // bounded whole, focused on the published wiki-node entry.
 const qlRef=`${p.worldA}/${p.qlNode}`;
 const qlRead=p.doorway({kind:"read",ref:qlRef});
 check(qlRead.state==="hosted"&&qlRead.entry?.label==="Bimba working note","[17b] The Bimba/QL object is an ordinary hosted subject in the joined field",{ref:qlRef,state:qlRead.state});
 const qlWhole=createKnowledgeEncounter({resource:qlRead.entry,relations:qlRead.neighbourhood?.relations??{error:"no relation view"},actions:qlRead.neighbourhood?.actions??[],sources:{ref:qlRead.entry.ref,revision:qlRead.entry.revision,provenance:qlRead.entry.provenance}});
 check(qlWhole.state==="available"&&JSON.stringify(qlWhole.nodes.flatMap(node=>node.provenance??[])).includes("ql-bimba-note"),"[17b] The Bimba/QL object encounters as a bounded whole carrying its own source lineage",{nodes:qlWhole.nodes?.length,focus:qlWhole.focus});
 // Step 10: explicit authority — the second world watches the subject under
 // its own participant; the publisher's contributor authority is disclosed.
 const watch=p.doorway({kind:"watch",watch:{schema:"oi.watch/v1",watch_ref:`watch:sf6:${p.run}:b`,field_ref:p.fieldA,watcher_participant_ref:p.participantB,target:{kind:"world",ref:p.worldA},state:"active",created_at:new Date().toISOString(),provenance:{source_system:"o-i",source_revision:`sf6:${p.run}`}}});
 check(watch.state==="active"&&watch.watcher_participant_ref===p.participantB,"[10] The second world watches the subject under explicit participant authority");
 // Step 11: summoning an authorised Agent. Agency is disclosed; invocation
 // requires the exact native owner binding — never membership alone.
 const snapshotRead=p.doorway({kind:"read",ref:p.worldA});
 const encounter=beingEncounter({state:"available",participants:snapshotRead.participants,relations:snapshotRead.relations,my_authority:snapshotRead.my_authority,projections:snapshotRead.projections},p.participantB);
 check(encounter.state==="available"&&encounter.agency,"[11] The projected Being discloses its agency in the joined field");
 const standing=invocationStanding(encounter,null);
 check(standing?.available===false&&typeof standing.reason==="string","[11] Without the exact native owner binding, summoning stays refused — membership is never enough",{reason:standing?.reason});
 // Steps 12-15: the ordinary shared act and the native owner return.
 const panel=explore.getByRole("complementary",{name:"Contributions"});await panel.getByRole("button",{name:"Contribute"}).click();
 const returned="The second world returns a joined difference through the ordinary composer.";await panel.getByLabel("Contributed material").fill(returned);await panel.getByRole("button",{name:"Submit Contribution"}).click();
 await panel.locator('[role="status"],[role="alert"]').waitFor({timeout:45000});const submitMessage=await panel.locator('[role="status"],[role="alert"]').innerText();
 check(submitMessage.includes("quarantined"),"[12] The contribution quarantines on the second machine's field");
 const contributionRef=submitMessage.match(/Contribution (contribution:[^ ]+) quarantined/)?.[1];
 const receipt=p.doorway({kind:"receipt",contribution_ref:contributionRef});
 check(receipt.state==="quarantined"&&receipt.field_ref===p.fieldA,"[12] The submitter's quarantine receipt is authoritative");
 await ownerPage(page,p,async owner=>{
  const ownerExplore=await openWorld(owner,p.worldA,p.run);
  const pending=ownerExplore.locator(`[data-pending-ingress="${receipt.ingress_ref}"]`);
  for(let cycle=0;cycle<3&&await pending.count()===0;cycle++){
   for(let attempt=0;attempt<6&&await pending.count()===0;attempt++){await ownerExplore.getByRole("button",{name:"Refresh the field"}).click();await owner.waitForTimeout(2000);}
  }
  await pending.waitFor({timeout:60000});
  await pending.getByRole("button",{name:"Admit Contribution"}).click();await pending.waitFor({state:"detached",timeout:30000});
 });
 const admitted=p.doorway({kind:"receipt",contribution_ref:contributionRef});
 check(admitted.state==="admitted","[13] The owner admitted the Contribution in the ordinary UI");
 const admittedContract=p.ownerDoorway({kind:"read",ref:p.worldA}).contributions.find(item=>item.contribution_ref===admitted.contribution_ref)?.contract;
 await ownerPage(page,p,async owner=>{
  const ownerExplore=await openWorld(owner,p.worldA,p.run);
  const returnRow=ownerExplore.locator(`[data-contribution-ref="${admitted.contribution_ref}"]`);
  await returnRow.waitFor({timeout:60000});
  await returnRow.getByRole("button",{name:"Return to source"}).click();
  const notice=ownerExplore.locator('.explore-contributions [role="status"],.explore-contributions [role="alert"]');
  await notice.waitFor({timeout:30000});
  if(!(await notice.innerText()).includes("Returned to the native owner for review."))throw new Error(`native Return failed: ${await notice.innerText()}`);
 });
 const listed=p.human("central.receiving.list",{project:"Editor",after:0,limit:200});
 const returnRow=listed.returns.filter(item=>item.document_id===p.doc.document_id&&item.source_ref===p.doc.source.ref).at(-1);
 check(returnRow?.status==="pending"&&returnRow.task_ref===p.projectionRef,"[13] The owner UI returned the admitted material to the real native receiving field");
 const nativeReturn=p.human("central.receiving.read",{project:"Editor",return_ref:returnRow.return_ref});
 const currentDoc=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});
 const reviewed=p.human("central.receiving.review",{project:"Editor",return_ref:returnRow.return_ref,expected_return_revision:nativeReturn.revision,disposition:"accepted",expected_source_revision:currentDoc.revision.revision});
 const included=p.human("central.receiving.include",{project:"Editor",return_ref:reviewed.return_ref,expected_return_revision:reviewed.revision,expected_source_revision:currentDoc.revision.revision});
 check(included.record.status==="included","[14] The native owner included the returned difference at the exact revision");
 const advanced=p.human("central.document.read",{project:"Editor",source_ref:p.doc.source.ref,document_id:p.doc.document_id});
 check(advanced.revision.revision!==p.doc.revision.revision,"[14] Distinct new source revision after inclusion");
 const p1=p.bundle.projection,presentation=worldPresentationFromProjection(p1);
 const p2=reviseProjection(p1,{source_revision:advanced.revision.revision,published_at:new Date().toISOString(),representation:{kind:"oi.world-presentation/v1",payload:{...presentation,revision:presentation.revision+1,summary:returned},},provenance:[...p1.provenance,{kind:"accepted-return",ref:admitted.contribution_ref,source_system:"central",revision:advanced.revision.revision}]});
 const args2={...p.argsA,putProjection:{...p.argsA.putProjection,projectionKey:`${p2.projection_ref}@${p2.projection_revision}`,projectionRevision:p2.projection_revision,sourceRevision:p2.source.revision,state:p2.state,contractJson:JSON.stringify(p2)},putExploreEntries:[],putExploreRelations:[]};
 p.ownerDoorway({kind:"publish",token_label:"sf6-a",args:args2});
 await explore.getByRole("button",{name:"Refresh the field"}).click({force:true});
 await page.waitForFunction(revision=>document.querySelector('.presentation-body[data-presentation-state="hosted"]')?.getAttribute("data-source-revision")===revision,advanced.revision.revision,{timeout:30000});
 check((await body.innerText()).includes(returned),"[15] The second world observes the returned difference after reprojection");
 // Step 16: the same semantic refs survive an owner-connection restart and a
 // second-world reload — no ref is renamed by transport churn.
 await restartOwnerBridge(p);
 // More than a reload: the second world returns through a completely fresh
 // client against the restarted owner connection, and every semantic ref is
 // unchanged.
 const freshContext=await page.context().browser().newContext();
 const fresh=await freshContext.newPage();
 // The runner injects the kernel bridge into its own page; a fresh client
 // needs the same bridge handed to it explicitly.
 await fresh.addInitScript(value=>window.__OI_KERNEL_BRIDGE__=value,`http://127.0.0.1:${process.env.WALK_BRIDGE_PORT??4179}`);
 await fresh.goto(baseUrl);
 const exploreAfter=await openWorld(fresh,p.worldA,p.run,p.readerRoot);
 const bodyAfter=exploreAfter.locator('.presentation-body[data-presentation-state="hosted"]');
 check(await bodyAfter.getAttribute("data-source-revision")===advanced.revision.revision&&await bodyAfter.getAttribute("data-projection-ref")===p.projectionRef&&await bodyAfter.getAttribute("data-expression-ref")===p.expressionRef,"[16] Source, Projection and Expression refs survive reconnect and restart unchanged");
 await freshContext.close();
 const stillThere=p.doorway({kind:"receipt",contribution_ref:contributionRef});
 check(stillThere.contribution_ref===contributionRef,"[16] Contribution identity survives transport churn");
 // Step 17a: the safe Nara presentation joins the SAME field under explicit
 // consent, is encountered by the admitted second world, and withdraws.
 const naraDoc=naraSafeCueDocument(p.naraRef);
 validateNaraCueExpression(naraDoc);
 const readerIdentity=p.doorway({kind:"identity",token_label:"owner"}).transport_identity;
 const naraTarget=`participant:sf6:${p.run}:nara-target`;
 const consent=createNaraPresenceConsent({consent_ref:`consent:sf6:${p.run}`,participant_ref:p.participantA,expression_ref:p.naraRef,target_ref:naraTarget,target_identity_ref:"human:sf6-second-world",granted_at:new Date().toISOString(),source_refs:["ql:nara:focus:m4"]});
 const naraBundle=projectNaraExpression({document:naraDoc,consent,field_ref:p.fieldA,publisher:{identity_ref:"human:sf6-owner",participant_ref:p.participantA},projection_ref:`projection:sf6-nara:${p.run}`,world_ref:p.worldA,published_at:new Date().toISOString(),audience:{visibility:"restricted",refs:[naraTarget]}});
 const naraArgs=hostedNaraExpressionArgs(naraBundle);
 p.ownerDoorway({kind:"publish",token_label:"sf6-a",args:naraArgs});
 const naraAdmission=p.ownerDoorway({kind:"participant",token_label:"sf6-a",participant:createParticipant({participant_ref:naraTarget,field_ref:p.fieldA,identity:{kind:"human",ref:"human:sf6-second-world"},presentation:{world_ref:"world:sf6-second-world"},provenance:{source_system:"o-i",source_revision:consent.granted_at,source_ref:consent.consent_ref}}),target_identity:readerIdentity,role:"observer",contactable:false});
 check(naraAdmission.bound_identity===readerIdentity,"[17a] The consented Nara target is admitted on the second world's own transport identity");
 const naraRead=p.doorway({kind:"read",ref:p.naraRef,token_label:"owner"});
 check(naraRead.state==="hosted"&&JSON.stringify(naraRead).toLowerCase().includes("ql:nara:focus:m4"),"The admitted reading carries the safe QL/Epii cues");
 for(const sentinel of NARA_SENTINELS)check(!JSON.stringify(naraRead).toLowerCase().includes(sentinel.toLowerCase()),`[17a] The Nara reading excludes ${sentinel}`);
 const naraProjectionRef=naraBundle.projection.projection_ref;
 check(naraRead.projections.some(row=>row.projection_ref===naraProjectionRef&&row.state==="published"),"[17a] The safe Nara Expression is hosted in the joined field under explicit consent");
 // Withdrawal supersedes at the stable ref.
 const withdrawnBundle=withdrawNaraProjection(naraBundle,consent,{withdrawn_at:new Date().toISOString(),withdrawal_ref:`consent:sf6:${p.run}:withdrawn`});
 const withdrawnArgs={...naraArgs,putProjection:{...naraArgs.putProjection,projectionKey:`${withdrawnBundle.projection.projection_ref}@${withdrawnBundle.projection.projection_revision}`,projectionRevision:withdrawnBundle.projection.projection_revision,state:withdrawnBundle.projection.state,contractJson:JSON.stringify(withdrawnBundle.projection)},putExploreEntries:[],putExploreRelations:[]};
 p.ownerDoorway({kind:"publish",token_label:"sf6-a",args:withdrawnArgs});
 const afterWithdrawal=p.doorway({kind:"read",ref:p.naraRef,token_label:"owner"});
 const currentNara=afterWithdrawal.projections.find(row=>row.projection_ref===naraProjectionRef);
 check(currentNara?.state==="withdrawn","[17a] The withdrawn Nara presence reads as withdrawn at its stable ref");
 await shot("sf6-joined-two-worlds");
}

async function restartOwnerBridge(p){
 p.ownerBridge.stop();
 p.ownerBridge=await startOwnerBridge(p.cradleRoot,p.ownerEnv);
 const bridgeIdentity=(await bridgeOp(p.ownerBridge.url,"shared_field",{kind:"identity"})).transport_identity;
 if(bridgeIdentity!==p.ownerIdentity)throw new Error(`owner bridge identity mismatch after restart: expected ${p.ownerIdentity}, got ${bridgeIdentity}`);
 await bridgeOp(p.ownerBridge.url,"expression",{operation:"open",document:p.expressionDocument,actor:"human:sf6-owner"});
 const reopened=await bridgeOp(p.ownerBridge.url,"expression",{operation:"inspect",expression_ref:p.expressionRef});
 if(reopened.document?.revision!==p.expressionDocument.revision)throw new Error(`the restarted owner bridge did not reopen the disclosed Expression`);
}
