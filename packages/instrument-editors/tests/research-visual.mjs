import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('../../../desktop/cradle/node_modules/playwright');
const evidence=new URL('../evidence/',import.meta.url).pathname;
const fixture=JSON.parse(await readFile(evidence+'modulation-native-result.json','utf8'));
const bridge=process.env.RESEARCH_BRIDGE??'http://127.0.0.1:4186';
async function inspect(expressionRef=fixture.expression_ref){const reply=await fetch(bridge+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request:{operation:'inspect',expression_ref:expressionRef}})}).then(response=>response.json());assert.equal(reply.ok,true);assert.ok(reply.outcome?.data?.document);return reply.outcome.data.document;}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],surfaces=[];
page.on('pageerror',error=>errors.push(String(error)));
const size=async(width,height)=>page.locator('.editor-workbench').evaluate((element,{width,height})=>{element.style.width=width+'px';element.style.height=height+'px';},{width,height});
const result={expression_ref:fixture.expression_ref,scene_ref:fixture.scene_ref,surfaces,errors,native_acceptance:{move:false,material:false},source_boundary:[],unverified:['Native fullscreen/popout','Undisclosed Wiki source facets are not fabricated']};
try{
 await page.goto('http://127.0.0.1:4298/?bridge='+encodeURIComponent(bridge),{waitUntil:'domcontentloaded'});
 for(const name of ['Canvas','Timeline','Places']){
  await page.getByRole('button',{name,exact:true}).click();
  const frame=page.locator('.instrument-frame').filter({has:page.getByRole('region',{name:name+' editor',exact:true,includeHidden:true})});
  await frame.waitFor({timeout:30000});await size(520,430);
  const stage=name==='Canvas'?frame.getByRole('region',{name:'Canvas editor',exact:true}):frame.getByRole('region',{name:name+' editor',exact:true});
  await stage.waitFor();
  if(name==='Canvas')await stage.getByRole('group',{name:'Native Canvas construction',exact:true}).waitFor({timeout:15000});
  else await page.waitForFunction(name=>{const root=document.querySelector('[data-instrument="'+name+'"]');return root?.getAttribute('aria-busy')==='false';},name,{timeout:30000});
  await page.screenshot({path:evidence+'research-'+name.toLowerCase()+'-compact.png'});
  await frame.getByRole('button',{name:'Expand '+name,exact:true}).click();await size(1180,780);
  await page.waitForFunction(name=>{const root=document.querySelector('[aria-label="'+name+' editor"]');return Boolean(root&&!root.hidden);},name);
  await frame.getByRole('button',{name:'Fold '+name,exact:true}).click();assert.equal(await stage.isVisible(),false);
  await frame.getByRole('button',{name:'Reopen '+name,exact:true}).click();assert.equal(await stage.isVisible(),true);
  await size(900,630);await page.screenshot({path:evidence+'research-'+name.toLowerCase()+'-full-resized.png'});
  const alerts=await frame.getByRole('alert').allTextContents(),text=await stage.innerText();
  surfaces.push({name,compact_full_fold_reopen_resize:true,alerts,rendered:await stage.locator('canvas,svg').count(),text:text.slice(0,4000)});
  result.source_boundary.push(...alerts.map(error=>({surface:name,error})));
  await frame.getByRole('button',{name:'Compact '+name,exact:true}).click();
 }
 // Read the actual source register and its native Expression through the
 // production receiving route; the native fork keeps exact provenance.
 try{
 await page.getByRole('button',{name:'Open actual Wiki research composition',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-receiver] button')].some(row=>row.textContent==='Show controlled modulation Scene')||Boolean(document.querySelector('[data-research-receiver] > [role=alert]')),{},{timeout:120000});
 if(!await page.getByRole('button',{name:'Show controlled modulation Scene',exact:true}).count())throw Error((await page.locator('[data-research-receiver] > [role=alert]').allTextContents()).join('\n')||'Actual Wiki receiver did not open.');
 const sourceReadback=JSON.parse(await page.locator('main > aside pre').innerText());result.source_readback=sourceReadback;
 assert.ok(sourceReadback.document?.expression_ref?.startsWith('expression:research-editor-'));
 const sourceBefore=await inspect(sourceReadback.document.expression_ref);result.source_before=sourceBefore;
 assert.deepEqual(sourceBefore,sourceReadback.document,'Receiver uses the exact native fork acknowledgement.');
 assert.equal(sourceReadback.source_standing.relations.state,'unavailable');
 assert.ok(sourceReadback.document.provenance.some(row=>row.availability==='available'&&row.ref==='wiki:'+sourceReadback.source_standing.wiki_basis.path&&row.revision===sourceReadback.source_standing.wiki_basis.revision));
 for(const name of ['Canvas','Timeline','Places']){
  await page.getByRole('button',{name,exact:true}).click();
  const frame=page.locator('.instrument-frame:visible').filter({has:page.getByRole('region',{name:name+' editor',exact:true,includeHidden:true})});
  await frame.waitFor();await size(620,460);
  const stage=frame.getByRole('region',{name:name+' editor',exact:true});await stage.waitFor();
  if(name!=='Canvas')await page.waitForFunction(name=>[...document.querySelectorAll('[aria-label="'+name+' editor"]')].some(row=>!row.closest('[hidden]')&&row.getAttribute('aria-busy')==='false'),name,{timeout:30000});
  await page.screenshot({path:evidence+'research-source-'+name.toLowerCase()+'-compact.png'});
  await frame.getByRole('button',{name:'Expand '+name,exact:true}).click();await size(1180,800);
  if(name==='Canvas')await frame.locator('.native-canvas-full .react-flow,.native-canvas-full [role="alert"],.native-canvas-full canvas').first().waitFor({timeout:30000});
  await frame.getByRole('button',{name:'Fold '+name,exact:true}).click();assert.equal(await stage.isVisible(),false);
  await frame.getByRole('button',{name:'Reopen '+name,exact:true}).click();await size(920,650);
  await page.screenshot({path:evidence+'research-source-'+name.toLowerCase()+'-full-resized.png'});
  const alerts=await frame.getByRole('alert').allTextContents();
  assert.equal(alerts.some(error=>error.includes('no exact Wiki register binding')),false,'Actual source provenance must reach the real reader.');
  surfaces.push({name,basis:'actual Wiki source / controlled native fork',compact_full_fold_reopen_resize:true,alerts,rendered:await stage.locator('canvas,svg').count(),text:(await stage.innerText()).slice(0,7000)});
  await frame.getByRole('button',{name:'Compact '+name,exact:true}).click();
 }
 const sourceAfter=await inspect(sourceBefore.expression_ref);result.source_after=sourceAfter;assert.deepEqual(sourceAfter,sourceBefore,'Source inspection and viewport changes leave the exact native source fork unchanged.');
 await page.getByRole('button',{name:'Show controlled modulation Scene',exact:true}).click();
 }catch(error){result.source_failure=String(error);result.source_ui=await page.locator('[data-research-receiver]').innerText();await page.screenshot({path:evidence+'research-source-refusal.png'});}

 await page.getByRole('button',{name:'Canvas',exact:true}).click();await size(650,490);
 const canvas=page.locator('[aria-label="Canvas editor"]:visible');
 const before=await inspect();result.before_move=before;
 const node=canvas.locator('svg [role="button"]').first();await node.click();
 // Selection itself uses the actual native focus operation. Let its owner
 // finish before capturing the placement input's revision.
 await page.waitForTimeout(500);
 const x=canvas.getByRole('spinbutton',{name:'Occurrence X',exact:true});
 if(await x.count()){
  const old=Number(await x.inputValue()),intended=String(old+.125);await x.fill(intended);await x.press('Enter');
  await page.waitForFunction(()=>{const row=document.querySelector('.native-canvas-status');return Boolean(row?.textContent&&!row.textContent.includes('Applying…'));},undefined,{timeout:20000});
  const after=await inspect();result.after_move=after;
  const status=await canvas.getByRole('status').allTextContents();result.move_status=status;
  assert.equal(await x.inputValue(),intended,'The intended native coordinate survives owner publication and refusal.');
  await page.getByRole('button',{name:'Expand Canvas',exact:true}).click();await page.getByRole('button',{name:'Compact Canvas',exact:true}).click();
  await page.getByRole('button',{name:'Fold Canvas',exact:true}).click();await page.getByRole('button',{name:'Reopen Canvas',exact:true}).click();
  assert.equal(await x.inputValue(),intended,'The same coordinate input survives full/compact/fold/reopen.');
  result.native_acceptance.move=after.revision>before.revision&&JSON.stringify(after.scenes)!==JSON.stringify(before.scenes);
  if(!result.native_acceptance.move)assert.deepEqual(after.scenes,before.scenes,'A refused move cannot change native Scene material.');
  await page.screenshot({path:evidence+'research-canvas-native-move.png'});
 }
 const material=canvas.getByRole('button',{name:'Create note',exact:true});
 if(await material.count()){
  const beforeMaterial=await inspect();result.before_material=beforeMaterial;await material.click();
  await page.waitForFunction(()=>{const row=document.querySelector('.native-canvas-status');return Boolean(row?.textContent&&!row.textContent.includes('Applying…'));},undefined,{timeout:20000});
  const afterMaterial=await inspect();result.after_material=afterMaterial;result.material_status=await canvas.getByRole('status').allTextContents();
  result.native_acceptance.material=afterMaterial.revision>beforeMaterial.revision&&JSON.stringify(afterMaterial.scenes)!==JSON.stringify(beforeMaterial.scenes);
  if(!result.native_acceptance.material)assert.deepEqual(afterMaterial.scenes,beforeMaterial.scenes,'A refused material edit cannot change the native document.');
  await page.screenshot({path:evidence+'research-canvas-native-material.png'});
 }
 assert.deepEqual(errors,[]);
 await writeFile(evidence+'research-browser-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({surfaces,native_acceptance:result.native_acceptance,source_boundary:result.source_boundary,source_failure:result.source_failure,errors}));
 if(result.source_failure)throw Error(result.source_failure);
}catch(error){result.failure=String(error);result.failure_ui=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:evidence+'research-failure.png'}).catch(()=>{});await writeFile(evidence+'research-browser-result.json',JSON.stringify(result,null,2));throw error;}finally{await browser.close();}
