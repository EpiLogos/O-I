import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bindDefaultCentral} from '../editor-doc.mjs';
import nativeRun,{setup} from './instrument-native-host.mjs';
export {setup};

const TARGET_IDENTITY='human:sf5-second-world';
const READER_TOKEN=`sf5-independent-reader-${process.pid}`;
const CRADLE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');

function doorway(cradleRoot,request,env=process.env){
  const script=resolve(cradleRoot,'../../shared-field/spacetimedb/field.sh');
  let stdout;
  try{stdout=execFileSync(script,{input:JSON.stringify(request),encoding:'utf8',env,stdio:['pipe','pipe','ignore']});}
  catch(error){stdout=error.stdout?.toString()??'';}
  return JSON.parse(stdout);
}

async function independentReaderPage({page,baseUrl,bridgeUrl,provision,expressionRef}){
  const readerContext=await page.context().browser().newContext({viewport:{width:1280,height:1600}});
  const other=await readerContext.newPage();
  await other.addInitScript(({bridge,ref})=>{
    window.__OI_KERNEL_BRIDGE__=bridge;
    sessionStorage.setItem('oi-cradle.welcome.v1','walk-continuing-session');
    localStorage.setItem('oi-cradle.explore.v1',JSON.stringify({schema:'oi.cradle.explore-travel/v1',visits:[{query:'',selected:ref}],index:0}));
  },{bridge:bridgeUrl,ref:expressionRef});
  await other.route('**/op',async route=>{
    const request=route.request();
    if(request.method()!=='POST')return route.continue();
    let operation;try{operation=request.postDataJSON();}catch{return route.continue();}
    if(operation?.op!=='shared_field')return route.continue();
    const envelope=doorway(CRADLE_ROOT,{...operation.request,token_label:READER_TOKEN},{...process.env,...provision.env});
    if(envelope.ok)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,outcome:{result:'shared_field_reading',data:envelope.data}})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:envelope.error?.message??'independent SharedField reader refused'})});
  });
  await other.goto(baseUrl);
  const chooser=other.getByRole('region',{name:'Central location'});
  if(await chooser.isVisible().catch(()=>false))await bindDefaultCentral(other,provision.root);
  const restore=other.getByRole('button',{name:'Restore pane arrangement'});
  if(await restore.isVisible().catch(()=>false))await restore.click();
  await other.evaluate(ref=>window.dispatchEvent(new CustomEvent('oi:open-explore',{detail:{ref,title:'Nara · safe cues'}})),expressionRef);
  const exploreTab=other.locator('.tab[data-title="Explore"]');
  await exploreTab.waitFor({state:'attached'});await exploreTab.evaluate(element=>element.click());
  const pane=exploreTab.locator('xpath=ancestor::section[1]');
  const maximize=pane.getByRole('button',{name:'Maximize this pane'});
  if(await maximize.count())await maximize.evaluate(element=>element.click());
  await other.bringToFront();
  await other.getByRole('region',{name:'Explore'}).waitFor();
  return {reader:other,readerContext};
}

export default async function run(context){
  await nativeRun(context);
  const {page,baseUrl,bridgeUrl,provision,check,shot}=context;
  const editor=page.locator('.agent-layer .expression-editor');
  const expressionRef=await editor.getAttribute('data-expression-ref');
  const targetParticipantRef=`participant:sf5:second-world:${expressionRef.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`;
  await editor.getByRole('button',{name:'Share / Project',exact:true}).click();
  const share=page.getByRole('region',{name:'Share / Project'});await share.waitFor();
  await share.getByLabel('Projection visibility').selectOption('restricted');
  await share.getByLabel('Audience participants').fill(targetParticipantRef);
  await share.getByLabel('Publisher identity').fill('human:sf5-native-owner');
  await share.getByLabel('Nara target identity').fill(TARGET_IDENTITY);
  await share.getByText('I explicitly consent',{exact:false}).locator('input').check();
  await share.getByRole('button',{name:'Create Projection',exact:true}).click();
  const created=share.locator('.share-created');await created.waitFor();
  let projection=JSON.parse(await created.getAttribute('data-projection'));
  const preview=await share.locator('[data-preview-payload]').getAttribute('data-preview-payload');
  const outward=JSON.stringify({projection,preview});
  for(const sentinel of ['bioquaternion','resonance','journal','activity body','particle','GPU','Agent context'])check(!outward.toLowerCase().includes(sentinel.toLowerCase()),`Outward Nara payload excludes ${sentinel}`);
  check(projection.audience.refs[0]===targetParticipantRef&&projection.subject.kind==='expression','Projection binds the safe Expression to the explicitly consented target',{projection_ref:projection.projection_ref,revision:projection.projection_revision});
  check(projection.relation_hints?.some(edge=>edge.kind==='consented-presence'&&edge.from===projection.publisher_participant_ref&&edge.to===targetParticipantRef&&edge.expression_ref===projection.subject.ref),'The admitted presence relation preserves its Participant endpoints and Expression ref');

  await share.getByLabel('Nara target identity').fill(`${TARGET_IDENTITY}:changed`);
  await page.waitForFunction(()=>document.querySelector('.share-projection')?.getAttribute('data-created')==='false');
  check(!(await share.getByText('I explicitly consent',{exact:false}).locator('input').isChecked()),'Changing the Nara target identity immediately invalidates consent and the created Projection');
  await share.getByLabel('Nara target identity').fill(TARGET_IDENTITY);
  await share.getByText('I explicitly consent',{exact:false}).locator('input').check();
  await share.getByRole('button',{name:'Create Projection',exact:true}).click();await created.waitFor();
  projection=JSON.parse(await created.getAttribute('data-projection'));

  await share.getByRole('button',{name:'Publish to the hosted field',exact:true}).click();
  const hosted=share.locator('.share-hosted');
  try{await hosted.waitFor({timeout:60000});}catch(error){throw new Error(`hosted Nara publish failed: ${await share.getByRole('alert').last().innerText().catch(()=>String(error))}`);}
  const hostedResult=JSON.parse(await hosted.getAttribute('data-hosted-result'));
  check(hostedResult.relations.length===0,'Nara publication does not invent an Explore geometry edge for participant presence',{relations:hostedResult.relations});

  const env={...process.env,...provision.env};
  const readerBefore=doorway(CRADLE_ROOT,{kind:'read',ref:projection.subject.ref,token_label:READER_TOKEN},env).data;
  check(!readerBefore?.projections?.some(item=>item.projection_ref===projection.projection_ref),'An independent transport identity cannot read the restricted Nara Projection before admission',{state:readerBefore?.state});
  const readerIdentity=doorway(CRADLE_ROOT,{kind:'snapshot',token_label:READER_TOKEN},env).data.transport_identity;
  const ownerRead=doorway(CRADLE_ROOT,{kind:'read',ref:projection.subject.ref},env).data;
  const targetParticipant={schema:'oi.participant/v1',participant_ref:targetParticipantRef,field_ref:ownerRead.field_ref,identity:{kind:'human',ref:TARGET_IDENTITY},presentation:{world_ref:`world:${TARGET_IDENTITY}`},provenance:{source_system:'o-i',source_revision:'sf5-walk',source_ref:projection.relation_hints[0].consent_ref}};
  const admission=doorway(CRADLE_ROOT,{kind:'participant',participant:targetParticipant,target_identity:readerIdentity,role:'observer'},env);
  check(admission.ok&&admission.data.bound_identity===readerIdentity,'The owner admits the target Participant to an independent reader transport identity',{participant_ref:targetParticipantRef,transport_identity:readerIdentity});

  const {reader,readerContext}=await independentReaderPage({page,baseUrl,bridgeUrl,provision,expressionRef:projection.subject.ref});
  const body=reader.locator(`.presentation-body[data-entry-ref="${projection.subject.ref}"]`);await body.waitFor({timeout:60000});
  const expression=body.locator(`[data-expression-ref="${projection.subject.ref}"][data-expression-state]`).first();await expression.waitFor({timeout:30000});
  const state=await expression.getAttribute('data-expression-state');
  check(['live','fallback'].includes(state)&&await body.getAttribute('data-projection-revision')==='1','A second Cradle under the admitted reader identity renders the exact live Expression or its explicit fallback',{state,projection_revision:1});
  const readerLive=doorway(CRADLE_ROOT,{kind:'read',ref:projection.subject.ref,token_label:READER_TOKEN},env).data;
  const encoded=JSON.stringify(readerLive);
  check(encoded.includes('ql:nara:focus:m4')&&encoded.includes('source:')&&!/bioquaternion|journal|activity body|Agent context|resonance/i.test(encoded),'The independent reader receives source/Epii cues while protected sentinels remain absent');
  await reader.getByRole('group',{name:'Contextual depth'}).getByRole('button',{name:'Source',exact:true}).click();
  const sourceDepth=reader.getByRole('complementary',{name:'Source and provenance of this subject'});await sourceDepth.waitFor();
  check((await sourceDepth.innerText()).includes(projection.source.ref),'The ordinary second-world Source affordance exposes the admitted Projection source; Epii remains the publisher-native boundary');
  await sourceDepth.getByRole('button',{name:'Dismiss source and provenance'}).click();await sourceDepth.waitFor({state:'detached'});
  check(await expression.isVisible(),'Dismissing Source returns to the same live Expression without widening disclosure');
  await shot('sf5-live-expression');

  await share.getByRole('button',{name:'Withdraw Nara presence',exact:true}).click();
  const withdrawn=share.locator('.share-withdrawn');await withdrawn.waitFor({timeout:60000});
  check(await withdrawn.getAttribute('data-projection-ref')===projection.projection_ref&&await withdrawn.getAttribute('data-projection-revision')==='2'&&await withdrawn.getAttribute('data-consent-state')==='withdrawn','Withdrawal invalidates consent on the next Projection revision while retaining the semantic ref');
  check(await share.locator('.share-created').count()===0,'Withdrawal removes the stale publish bundle from the ordinary desktop flow');
  await reader.getByRole('button',{name:'Refresh the field'}).click();
  await reader.locator('.presentation-body[data-projection-state="withdrawn"][data-projection-revision="2"] [data-renderer-state="withdrawn"]').waitFor({timeout:60000});
  check(await reader.locator(`[data-expression-ref="${projection.subject.ref}"][data-expression-state]`).count()===0,'The admitted second desktop stops rendering the Expression after withdrawal');
  await shot('sf5-withdrawn');

  await withdrawn.getByRole('button',{name:'Re-enter with new consent'}).click();
  await share.getByText('I explicitly consent',{exact:false}).locator('input').check();
  await share.getByRole('button',{name:'Create Projection',exact:true}).click();
  const reentered=share.locator('.share-created');await reentered.waitFor();
  check(await reentered.getAttribute('data-projection-ref')===projection.projection_ref&&await reentered.getAttribute('data-projection-revision')==='3','Re-entry uses a fresh consent and revision with the same Projection and Expression refs');
  await reentered.getByRole('button',{name:'Publish to the hosted field',exact:true}).click();await share.locator('.share-hosted').waitFor({timeout:60000});
  await reader.getByRole('button',{name:'Refresh the field'}).click();
  await reader.locator('.presentation-body[data-projection-state="published"][data-projection-revision="3"]').waitFor({timeout:60000});
  const reenteredExpression=reader.locator(`[data-expression-ref="${projection.subject.ref}"][data-expression-state]`).first();await reenteredExpression.waitFor({timeout:30000});
  check(['live','fallback'].includes(await reenteredExpression.getAttribute('data-expression-state')),'The independent second desktop reads the re-entered live Expression at revision 3 through the real hosted field',{ref:projection.subject.ref});
  const reenteredProjection=JSON.parse(await reentered.getAttribute('data-projection'));
  const parallelProjection={...reenteredProjection,projection_ref:`${projection.projection_ref}:parallel`,projection_revision:1};
  const parallel=doorway(CRADLE_ROOT,{kind:'projection',field_ref:ownerRead.field_ref,projection:parallelProjection},env);
  check(parallel.ok,'A second caller-owned active Nara Projection is retained for lifecycle recovery coverage',{projection_ref:parallelProjection.projection_ref});
  await page.context().setOffline(true);
  await share.getByRole('button',{name:'Close share'}).click();await share.waitFor({state:'detached'});
  await editor.getByRole('button',{name:'Share / Project',exact:true}).click();await share.waitFor();
  const recoveryFailure=share.locator('.share-recovery-failed');await recoveryFailure.waitFor({timeout:60000});
  check(await share.getByRole('button',{name:'Create Projection',exact:true}).isDisabled(),'A real offline recovery failure keeps fresh Nara publication locked while the hosted Projection remains retained');
  await page.context().setOffline(false);
  await recoveryFailure.getByRole('button',{name:'Retry hosted consent recovery'}).click();
  const recoveredRows=share.locator('.share-recovered');await recoveredRows.first().waitFor({timeout:60000});
  check(await recoveredRows.count()===2,'Recovery collapses revisions per Projection ref and surfaces every active caller-owned presence');
  await share.getByRole('button',{name:`Withdraw ${parallelProjection.projection_ref}`}).click();await page.waitForFunction(()=>document.querySelectorAll('.share-recovered').length===1);
  check(true,'Each recovered active presence has its own withdrawal control');
  const recovered=share.locator('.share-recovered[data-projection-revision="3"]');await recovered.waitFor({timeout:60000});
  check(true,'Restored transport recovers the retained actual hosted Projection through an authoritative field read');
  check(await share.getByLabel('Audience participants').isDisabled()&&await share.getByLabel('Nara target identity').isDisabled(),'Reopening Share recovers the caller-owned hosted consent and freezes its published scope');
  await recovered.getByRole('button',{name:'Withdraw Nara presence'}).click();await share.locator('.share-withdrawn[data-projection-revision="4"]').waitFor({timeout:60000});
  await reader.getByRole('button',{name:'Refresh the field'}).click();await reader.locator('.presentation-body[data-projection-state="withdrawn"][data-projection-revision="4"]').waitFor({timeout:60000});
  check(true,'Recovered consent remains withdrawable after closing and reopening Share');
  await share.getByRole('button',{name:'Re-enter with new consent'}).click();await share.getByText('I explicitly consent',{exact:false}).locator('input').check();await share.getByRole('button',{name:'Create Projection',exact:true}).click();
  const reopenedReentry=share.locator('.share-created[data-projection-revision="5"]');await reopenedReentry.waitFor();check(await reopenedReentry.getAttribute('data-projection-ref')===projection.projection_ref,'Recovered re-entry keeps the same semantic Projection ref at revision 5');
  await reopenedReentry.getByRole('button',{name:'Publish to the hosted field'}).click();await share.locator('.share-hosted').waitFor({timeout:60000});await reader.getByRole('button',{name:'Refresh the field'}).click();await reader.locator('.presentation-body[data-projection-state="published"][data-projection-revision="5"]').waitFor({timeout:60000});check(true,'The independent reader receives the recovered re-entry at revision 5');
  await reader.waitForTimeout(15000);
  const settledSubjects=reader.locator('[data-region-ref="subjects"] .world-binding');
  check(await settledSubjects.count()===8,'The second-world subject table retains eight safe locus refs beside the settled live frame');
  await reader.screenshot({path:resolve(CRADLE_ROOT,'walk/artifacts/sf5-independent-reader-reentered.png'),fullPage:true});
  await readerContext.close();
  await shot('sf5-reentered');
}
