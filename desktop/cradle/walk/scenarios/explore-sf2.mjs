// SF2 living knowledge encounter: the running desktop consumes one real
// hosted Wiki local whole through the SharedField client, changes readings
// without changing semantic state, recentres through an admitted relation,
// and returns through the existing Explore history.
import {setup as sourceSetup} from './editor.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {projectCentralWikiWorld,hostedPublicationArgs} from '../../../../shared-field/central-wiki-projection.mjs';
import {bindDefaultCentral} from '../editor-doc.mjs';

export async function setup(args) {
  const publisher=await sourceSetup(args);
  let provision;
  try { provision=await sourceSetup(args); } catch(error) { publisher.cleanup();throw error; }
  const run=Date.now().toString(36);
  const root=publisher.call('central.wiki.read');
  const project=publisher.call('projectcentral.wiki.read',{project:'Editor'});
  const worldRef=`world:sf2:${run}`;
  const bundle=projectCentralWikiWorld({readings:[root,project],selection:{schema:'oi.central-wiki-selection/v1',world_ref:worldRef,subject_world_ref:project.world_ref,field_ref:`oi:field:sf2:${run}`,projection_ref:`projection:sf2:${run}`,presentation_ref:`presentation:sf2:${run}`,title:'SF2 native knowledge',audience:{visibility:'public'},publisher:{participant_ref:`participant:sf2:${run}`,identity_ref:`human:sf2:${run}`,chosen_name:'Knowledge publisher'},spaces:{[root.spaces[0].ref]:'address',[project.spaces[0].ref]:'nodes'},node_refs:[],disclose_source_refs:true},published_at:new Date().toISOString()});
  const env={...provision.env,OI_STATE_HOME:join(provision.env.OI_HOME,'shared-field'),OI_REPO_ROOT:resolve(args.cradleRoot,'../..')};
  const publisherEnv={...publisher.env,OI_STATE_HOME:join(publisher.env.OI_HOME,'shared-field'),OI_REPO_ROOT:env.OI_REPO_ROOT};
  try {
    // The publisher and reader obtain distinct real transport identities.
    const published=JSON.parse(execFileSync(resolve(args.cradleRoot,'../../shared-field/spacetimedb/field.sh'),[],{env:{...process.env,...publisherEnv},input:JSON.stringify({kind:'publish',token_label:'publisher',args:hostedPublicationArgs(bundle)}),encoding:'utf8'}));
    if(!published.ok)throw new Error(JSON.stringify(published));
    return {...provision,env,worldRef,publisherRoot:publisher.root,publisherHome:publisher.env.OI_HOME,publisherIdentity:published.data.transport_identity,cleanup:()=>{provision.cleanup();publisher.cleanup();}};
  } catch(error) { provision.cleanup();publisher.cleanup();throw error; }
}

export default async function run({page,baseUrl,check,metric,shot,channel,provision}) {
  check(provision.root!==provision.publisherRoot&&provision.env.OI_HOME!==provision.publisherHome,'Publisher and reader have independently initialized native Central roots and application homes',{publisher:provision.publisherRoot,reader:provision.root});
  await page.goto(baseUrl); await channel('info');
  const chooser=page.getByRole('region',{name:'Central location'});
  if(await chooser.isVisible().catch(()=>false))await bindDefaultCentral(page,provision.root);
  const nav=page.getByRole('complementary',{name:'World navigator'});
  if(!await nav.isVisible())await page.keyboard.press('Meta+b');
  await nav.getByRole('button',{name:'Open Explore',exact:true}).click();
  const explore=page.getByRole('region',{name:'Explore'});await explore.waitFor({timeout:15000});
  await explore.locator('[data-field-state="available"]').waitFor({timeout:60000});
  const snapshot=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'snapshot'}}])).data.outcome.data;
  check(snapshot.transport_identity!==provision.publisherIdentity,'Publisher and reader use independent real hosted transport identities');
  const wiki=snapshot.entries.find(entry=>entry.world_ref===provision.worldRef&&(entry.kind==='wiki-node'||entry.kind==='wiki-space')&&snapshot.relations.some(relation=>relation.from===entry.ref||relation.to===entry.ref));
  check(Boolean(wiki),'The independently hosted world exposes an addressable Wiki/Bimba subject',{counts:snapshot.counts,ref:wiki?.ref});
  await explore.getByRole('searchbox',{name:'Search the open field'}).fill(wiki.ref);
  await explore.getByRole('searchbox',{name:'Search the open field'}).press('Enter');
  const started=Date.now();await explore.locator(`.explore-results [data-explore-ref=${JSON.stringify(wiki.ref)}] button`).click();
  const encounter=explore.getByRole('region',{name:'Projected knowledge local whole'});await encounter.waitFor({timeout:60000});metric('knowledge_open_ms',Date.now()-started);
  const reading=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'read',ref:wiki.ref}}])).data.outcome.data;
  const local=reading.neighbourhood.relations;
  check(await encounter.getAttribute('data-focus-ref')===wiki.ref&&Number(await encounter.getAttribute('data-node-count'))===local.nodes.length&&Number(await encounter.getAttribute('data-relation-count'))===local.edges.length,'Desktop renders the owner-returned bounded whole without adding nodes or relations',{focus:local.focus,nodes:local.nodes.length,relations:local.edges.length});
  const graph=encounter.getByRole('group',{name:'Bounded typed knowledge constellation'});await graph.waitFor();
  const geometry=async(region,ref)=>region.locator('.knowledge-encounter__graph').evaluate((svg,ref)=>{
    const node=[...svg.querySelectorAll('[data-knowledge-ref]')].find(row=>row.getAttribute('data-knowledge-ref')===ref);
    if(!node)throw new Error(`Current owner node is absent: ${ref}`);
    const point=new DOMPoint(0,0).matrixTransform(node.getScreenCTM());
    const box=svg.viewBox.baseVal,centre=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(svg.getScreenCTM());
    const camera=svg.getScreenCTM().inverse().multiply(svg.firstElementChild.getScreenCTM());
    return {dx:point.x-centre.x,dy:point.y-centre.y,zoom:camera.a,picked:svg.getAttribute('data-selected')};
  },ref);
  const centred=await geometry(encounter,wiki.ref);
  check(Math.hypot(centred.dx,centred.dy)<2,'Follow centres the actual owner locus in SVG geometry',centred);
  await graph.locator(`[data-knowledge-ref=${JSON.stringify(wiki.ref)}]`).click();
  const bounds=await graph.boundingBox();if(!bounds)throw new Error('Native graph has no viewport');
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.keyboard.down('Control');try{await page.mouse.wheel(0,-30);}finally{await page.keyboard.up('Control');}
  await page.waitForFunction(()=>{const svg=document.querySelector('.knowledge-encounter__graph');return svg&&svg.getScreenCTM().inverse().multiply(svg.firstElementChild.getScreenCTM()).a>1;},null,{timeout:15000});
  await page.mouse.wheel(37,19);
  await page.waitForFunction(ref=>{const svg=document.querySelector('.knowledge-encounter__graph');if(!svg)return false;const node=[...svg.querySelectorAll('[data-knowledge-ref]')].find(node=>node.getAttribute('data-knowledge-ref')===ref);if(!node)return false;const point=new DOMPoint(0,0).matrixTransform(node.getScreenCTM()),box=svg.viewBox.baseVal,centre=new DOMPoint(box.width/2,box.height/2).matrixTransform(svg.getScreenCTM());return Math.hypot(point.x-centre.x,point.y-centre.y)>10;},wiki.ref,{timeout:15000});
  const beforeModes=await geometry(encounter,wiki.ref);
  check(beforeModes.zoom>1&&Math.hypot(beforeModes.dx,beforeModes.dy)>10&&beforeModes.picked===wiki.ref,'Real zoom/pan and single selection change disposable geometry without opening another owner ref',beforeModes);
  for(const mode of ['list','page','graph'])await encounter.getByRole('button',{name:mode,exact:true}).click();
  const afterModes=await geometry(encounter,wiki.ref);
  check(afterModes.picked===wiki.ref&&Math.abs(afterModes.zoom-beforeModes.zoom)<1e-6&&Math.hypot(afterModes.dx-beforeModes.dx,afterModes.dy-beforeModes.dy)<2,'Graph/list/page return preserves actual camera offset, zoom and exact single-selected ref', {beforeModes,afterModes});
  const titles=await graph.locator('title').allTextContents();
  check(local.edges.every(edge=>titles.some(title=>title.includes(edge.relation)&&edge.provenance.every(row=>title.includes(row.ref)&&(!row.revision||title.includes(row.revision))))),'Graph labels preserve exact relation kinds and provenance revisions',{relations:local.edges.map(edge=>({relation:edge.relation,provenance:edge.provenance}))});
  await encounter.getByRole('button',{name:'list',exact:true}).click();
  check(await encounter.locator('.knowledge-encounter__list > li').count()===local.nodes.length,'LIST is another reading over the same selected relation state');
  await encounter.getByRole('button',{name:'tree',exact:true}).click();
  check(await encounter.locator('.knowledge-encounter__tree ol > li').count()===local.edges.filter(edge=>edge.from===local.focus||edge.to===local.focus).length,'TREE is another reading over the same typed neighbours');
  await encounter.getByRole('button',{name:'page',exact:true}).click();
  check(await encounter.locator('.world-presentation').count()===1,'Page uses the existing WorldPresentation over the same selected subject');
  const expression=encounter.getByRole('button',{name:'Expression',exact:true});await expression.click();
  const expressed=encounter.getByRole('status').filter({hasText:/subjects · .*typed relations · Expression r/});await expressed.waitFor({timeout:60000});
  check((await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('explore-knowledge-expression:')),'The hosted bounded whole is alive through the existing Expression application and shared stage',{status:await expressed.innerText()});
  const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,32);
  const expressionRef=`expression:knowledge-${digest(`explore:${wiki.world_ref}:${wiki.ref}`)}`;
  const document=(await channel('invoke.kernel_op',[{op:'expression',request:{operation:'inspect',expression_ref:expressionRef}}])).data.outcome.data.document;
  for(const node of local.nodes) {
    const entityRef=`${expressionRef}:entity:k-${digest(node.ref)}`;
    const subject=document.entities[entityRef]?.subject;
    check(Boolean(subject),'Every admitted local-whole member has a native Expression subject binding',{subject_ref:node.ref});
    check(subject.readings.some(row=>row.ref===node.ref&&row.revision===node.revision)&&node.provenance.every(source=>subject.sources.some(row=>row.ref===source.ref&&row.revision===(source.revision??'revision-unavailable'))),'Native EX3 subject binding retains the hosted node and source revisions',{subject_ref:node.ref,sources:subject.sources});
  }
  check(local.edges.every(edge=>Object.values(document.relations).some(binding=>binding.relation.ref===edge.relation_ref&&edge.provenance.some(row=>row.ref===binding.relation.ref&&row.revision===binding.relation.revision))),'Native Expression preserves each owner-disclosed relation identity and exact revision');
  const hostBounds=await encounter.locator('.knowledge-encounter__expression').boundingBox();
  const canvasBounds=await encounter.locator('.knowledge-encounter__expression canvas').boundingBox();
  check(Boolean(hostBounds&&canvasBounds&&Math.abs(hostBounds.x-canvasBounds.x)<2&&Math.abs(hostBounds.y-canvasBounds.y)<2&&Math.abs(hostBounds.width-canvasBounds.width)<3&&Math.abs(hostBounds.height-canvasBounds.height)<3),'The shared Expression canvas stays within the selected Surface container',{hostBounds,canvasBounds});
  check(await encounter.getByRole('navigation',{name:'Subjects in this Expression'}).getByRole('button').count()===local.nodes.length,'Every live Expression member remains labelled and addressable through the same subject refs');
  await shot('living-knowledge-expression');
  await encounter.getByRole('button',{name:'Pin',exact:true}).click();
  // Human-facing labels come from the current owner reading. The pin's
  // exact semantic address is carried separately by its existing native binding.
  const pin=encounter.locator(`.knowledge-encounter__pins button[data-subject-ref=${JSON.stringify(wiki.ref)}]`);
  const storedPins=await page.evaluate(world=>JSON.parse(localStorage.getItem(`oi-cradle.knowledge.${encodeURIComponent(world)}.pins.v2`)??'null'),reading.entry.world_ref);
  check(await encounter.getByRole('button',{name:'Pinned',exact:true}).getAttribute('aria-pressed')==='true'&&await pin.count()===1&&Array.isArray(storedPins)&&storedPins.includes(wiki.ref),'Pin persists the exact projected semantic ref in the knowledge presentation',{world_ref:reading.entry.world_ref,subject_ref:wiki.ref,storedPins});
  await encounter.getByRole('button',{name:'Following locus',exact:true}).click();
  check(await encounter.getByRole('button',{name:'Follow locus',exact:true}).getAttribute('aria-pressed')==='false','Follow can freeze the visual locus without creating a second navigation history');
  await encounter.getByRole('button',{name:'graph',exact:true}).click();
  check(!(await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('explore-knowledge-expression:')),'Changing presentation releases the hidden Expression stage');
  const heldCentre=await geometry(encounter,wiki.ref);
  check(Math.hypot(heldCentre.dx,heldCentre.dy)<2,'Hold recentres the actual retained locus after deliberate pan',heldCentre);
  const neighbour=local.nodes.find(node=>node.ref!==local.focus&&node.availability!=='unavailable');
  check(Boolean(neighbour),'The real owner relation state supplies a recenterable neighbour',{nodes:local.nodes.map(node=>node.ref)});
  const firstEntity=Object.values(document.entities).find(entity=>entity.subject);
  const changed=(await channel('invoke.kernel_op',[{op:'expression',request:{operation:'edit',expression_ref:expressionRef,expected_revision:document.revision,actor:'human:sf2-regression',changes:[{change:'subject_bind',entity_ref:firstEntity.entity_ref,binding:{...firstEntity.subject,readings:firstEntity.subject.readings.map(row=>({...row,revision:'prior-owner-reading',availability:'stale'}))}}]}}])).data.outcome.data.document;
  check(Boolean(changed),'Native owner stores a prior reading for the cancellation regression');
  let deliver, observed, complete;
  const held=new Promise(resolve=>{deliver=resolve;});
  const captured=new Promise(resolve=>{observed=resolve;});
  const delivered=new Promise(resolve=>{complete=resolve;});
  let delayed=false;
  const delayNativeInspect=async route=>{
    const request=route.request().postDataJSON();
    if(delayed||request?.op!=='expression'||request.request?.operation!=='inspect'){await route.continue();return;}
    delayed=true;
    const response=await route.fetch(); // Real native response; only its delivery is delayed.
    observed();await held;
    try{await route.fulfill({response});complete(null);}catch(error){complete(error);}
  };
  await page.route('**/op',delayNativeInspect);
  await encounter.getByRole('button',{name:'Expression',exact:true}).click();
  let captureTimeout;
  try { await Promise.race([captured,new Promise((_,reject)=>{captureTimeout=setTimeout(()=>reject(new Error('Native inspect was not captured within 15 seconds')),15000);})]); } finally { clearTimeout(captureTimeout); }
  // A single press only selects; a deliberate double-click opens the subject.
  await graph.locator(`[data-knowledge-ref=${JSON.stringify(neighbour.ref)}]`).dblclick();
  deliver();
  const deliveryError=await delivered;
  await page.unroute('**/op',delayNativeInspect);
  if(deliveryError)throw deliveryError;
  await explore.locator(`[data-selected-ref=${JSON.stringify(neighbour.ref)}]`).waitFor({timeout:60000});
  check((await explore.getAttribute('data-selected-ref'))===neighbour.ref,'Neighbour activation recentres through the existing Explore selection with the exact ref');
  await explore.getByRole('region',{name:'Projected knowledge local whole'}).waitFor({timeout:60000});
  check(!(await channel('read.stage')).data.presentations.some(item=>item.id.startsWith('explore-knowledge-expression:')),'A late native Expression reply cannot remount a departed knowledge Surface');
  await explore.locator(`[data-knowledge-ref=${JSON.stringify(wiki.ref)}]`).waitFor({timeout:60000});
  const heldAfterOpen=await geometry(encounter,wiki.ref);
  check(Math.hypot(heldAfterOpen.dx,heldAfterOpen.dy)<2,'Opening an admitted neighbour preserves the actual held owner locus at the centre',heldAfterOpen);
  await encounter.getByRole('button',{name:'Follow locus',exact:true}).click();
  const followed=await geometry(encounter,neighbour.ref);
  check(Math.hypot(followed.dx,followed.dy)<2,'Follow recentres on the new actual owner locus',followed);
  const afterCancellation=(await channel('invoke.kernel_op',[{op:'expression',request:{operation:'inspect',expression_ref:expressionRef}}])).data.outcome.data.document;
  check(JSON.stringify(afterCancellation)===JSON.stringify(changed),'Departing during native inspect prevents the cancelled request from editing the owner document');
  check(await pin.count()===1&&await pin.isEnabled(),'Pinned semantic ref remains traversable after recentering',{subject_ref:await pin.getAttribute('data-subject-ref'),label:await pin.innerText()});
  await explore.getByRole('button',{name:'Back',exact:true}).click();await explore.locator(`[data-selected-ref=${JSON.stringify(wiki.ref)}]`).waitFor({timeout:60000});
  await explore.getByRole('button',{name:'Forward',exact:true}).click();await explore.locator(`[data-selected-ref=${JSON.stringify(neighbour.ref)}]`).waitFor({timeout:60000});
  check(true,'Back and Forward restore exact knowledge refs through Explore’s existing bounded history');
  await explore.getByRole('button',{name:'Source',exact:true}).click();const source=explore.getByRole('complementary',{name:'Source and provenance of this subject'});await source.waitFor();
  const selectedReading=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'read',ref:neighbour.ref}}])).data.outcome.data;
  const sourceText=await source.innerText();
  check(sourceText.includes(neighbour.ref)&&selectedReading.entry.provenance.every(row=>sourceText.includes(row.ref)&&(!row.revision||sourceText.includes(row.revision))),'Source/properties depth exposes the selected subject and its exact provenance revisions');
  await shot('living-knowledge-source');
  await source.getByRole('button',{name:'Dismiss source and provenance'}).click();
  await explore.getByRole('button',{name:'Open as Surface',exact:true}).click();const popout=page.getByRole('region',{name:'Projected subject'});await popout.waitFor({timeout:15000});
  check((await popout.getAttribute('data-selected-ref'))===neighbour.ref,'Page/popout uses an ordinary Surface binding with the same projected subject ref');
  await page.locator('.tab').filter({hasText:'Explore'}).first().click();await explore.waitFor();
  await explore.getByRole('button',{name:'Back',exact:true}).click();
  check((await explore.getAttribute('data-selected-ref'))===wiki.ref,'Return restores the prior knowledge locus with history intact');
  await shot('living-knowledge-return');
  await page.context().setOffline(true);
  await explore.getByRole('button',{name:'Refresh the field',exact:true}).click();
  await explore.locator('[data-presentation-state="unavailable"]').waitFor({timeout:15000});
  check(await explore.getByRole('button',{name:'Refresh the field',exact:true}).isVisible()&&await explore.getAttribute('data-selected-ref')===wiki.ref,'A real connection loss retains the knowledge address and leaves Refresh and travel reachable');
  await page.context().setOffline(false);
  await explore.getByRole('button',{name:'Refresh the field',exact:true}).click();
  await encounter.waitFor({timeout:60000});
  check(await encounter.getAttribute('data-focus-ref')===wiki.ref&&await encounter.getByRole('button',{name:'Pinned',exact:true}).getAttribute('aria-pressed')==='true','Restored hosted access reopens the same bounded knowledge subject and semantic pin');
  await shot('living-knowledge-restored');
  const restoredGraph=encounter.locator('.knowledge-encounter__graph');await restoredGraph.waitFor();
  await restoredGraph.locator(`[data-knowledge-ref=${JSON.stringify(wiki.ref)}]`).click();
  const restartBounds=await restoredGraph.boundingBox();if(!restartBounds)throw new Error('Restored graph has no viewport');
  await page.mouse.move(restartBounds.x+restartBounds.width/2,restartBounds.y+restartBounds.height/2);await page.mouse.wheel(29,13);
  await page.waitForFunction(ref=>{
    const svg=document.querySelector('[aria-label="Explore"] .knowledge-encounter__graph');if(!svg)return false;
    const node=[...svg.querySelectorAll('[data-knowledge-ref]')].find(node=>node.getAttribute('data-knowledge-ref')===ref);if(!node)return false;
    const point=new DOMPoint(0,0).matrixTransform(node.getScreenCTM()),box=svg.viewBox.baseVal,centre=new DOMPoint(box.width/2,box.height/2).matrixTransform(svg.getScreenCTM());
    return Math.hypot(point.x-centre.x,point.y-centre.y)>10;
  },wiki.ref,{timeout:15000});
  const beforeRestart=await geometry(encounter,wiki.ref);
  await encounter.getByRole('button',{name:'page',exact:true}).click();
  await page.reload();await channel('info');await explore.waitFor({timeout:60000});await encounter.waitFor({timeout:60000});
  check(await encounter.locator('[data-knowledge-presentation="page"]').isVisible(),'Existing Explore travel restores the selected presentation mode on reload');
  await encounter.getByRole('button',{name:'graph',exact:true}).click();
  const afterRestart=await geometry(encounter,wiki.ref);
  const reread=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'read',ref:wiki.ref}}])).data.outcome.data;
  check(reread.state==='hosted'&&reread.entry.ref===reading.entry.ref&&reread.entry.world_ref===reading.entry.world_ref&&reread.entry.revision===reading.entry.revision,'Restart retains no graph authority and reacquires the same actual owner identity/revision');
  check(afterRestart.picked===wiki.ref&&Math.abs(afterRestart.zoom-beforeRestart.zoom)<1e-6&&Math.hypot(afterRestart.dx-beforeRestart.dx,afterRestart.dy-beforeRestart.dy)<2,'Global restart restores actual camera and selected ref through the existing bounded travel codec',{beforeRestart,afterRestart});
}
