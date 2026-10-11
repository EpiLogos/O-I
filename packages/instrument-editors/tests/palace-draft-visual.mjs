import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('../../../desktop/cradle/node_modules/playwright');
const evidence=new URL('../evidence/',import.meta.url).pathname;
const fixture=JSON.parse(await readFile(evidence+'native-result.json','utf8'));
assert.match(fixture.expression_ref,/^expression:instrument-editor-[a-f0-9-]+$/);
const bridge=process.env.OI_EDITOR_TEST_BRIDGE??'http://127.0.0.1:4186';
async function expression(request){const result=await fetch(bridge+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request}),signal:AbortSignal.timeout(30000)}).then(r=>r.json());assert.equal(result.ok,true,result.error);return result.outcome.data;}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}}),result={expression_ref:fixture.expression_ref,controlled_native:true,errors:[]};
page.on('pageerror',error=>result.errors.push(String(error)));
try{
 await page.goto('http://127.0.0.1:4298/?bridge='+encodeURIComponent(bridge),{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Palace',exact:true}).click();
 const frame=page.locator('.instrument-frame:visible');await frame.getByRole('button',{name:'Expand Palace',exact:true}).click();
 const palace=frame.getByRole('region',{name:'Palace editor',exact:true});
 const name=palace.getByRole('textbox',{name:'New room name',exact:true});await name.waitFor({timeout:30000});await page.waitForFunction(()=>{const field=document.querySelector('[aria-label="New room name"]');return field&&!field.closest('fieldset').disabled;},undefined,{timeout:30000});
 const basis=JSON.parse(await palace.locator('details pre').textContent());
 const before=(await expression({operation:'inspect',expression_ref:fixture.expression_ref})).document;assert.equal(before.revision,basis.revision);
 await name.fill('Retained unsubmitted room');
 const edit=await expression({operation:'edit',expression_ref:fixture.expression_ref,expected_revision:before.revision,actor:'agent:instrument-editor-native-test',changes:[{change:'scene_rename',scene_ref:before.scenes[0].scene_ref,title:'Externally advanced controlled Palace r'+before.revision}]});assert.equal(edit.state,'ready');
 const external=(await expression({operation:'inspect',expression_ref:fixture.expression_ref})).document;assert.equal(external.revision,before.revision+1);
 // Actual visibility refresh, over the existing retained instance. The room
 // name has not been submitted, and cannot quietly acquire the new basis.
 await page.getByRole('button',{name:'Modulation',exact:true}).click();await page.getByRole('button',{name:'Palace',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.instrument-palace [role="status"]')?.textContent?.includes('source has advanced'),undefined,{timeout:30000});
 assert.equal(await name.inputValue(),'Retained unsubmitted room');assert.equal(JSON.parse(await palace.locator('details pre').textContent()).revision,before.revision);
 result.unsubmitted_name_basis_retained=true;
 await palace.getByRole('button',{name:'Add room',exact:true}).click();await palace.getByRole('button',{name:'Save composition',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.instrument-palace [role="status"]')].some(row=>row.textContent?.includes('changed elsewhere')),undefined,{timeout:30000});
 assert.deepEqual((await expression({operation:'inspect',expression_ref:fixture.expression_ref})).document,external);
 assert.ok(await palace.getByRole('button',{name:/Retained unsubmitted room/}).count());
 result.refused_save_retains_composition=true;result.native_after_refusal=external;
 await page.screenshot({path:evidence+'palace-draft-native-refusal.png'});
 await palace.getByRole('button',{name:'Revert draft',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.instrument-palace [role="status"]')].some(row=>row.textContent?.includes('Draft reverted')),undefined,{timeout:30000});
 assert.equal(await name.inputValue(),'');assert.equal(JSON.parse(await palace.locator('details pre').textContent()).revision,external.revision);
 assert.deepEqual((await expression({operation:'inspect',expression_ref:fixture.expression_ref})).document,external);assert.deepEqual(result.errors,[]);
 result.explicit_revert_adopts_current_basis=true;result.passed=true;
}catch(error){result.passed=false;result.failure=String(error);result.ui=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:evidence+'palace-draft-failure.png'}).catch(()=>{});throw error;}
finally{await browser.close();await writeFile(evidence+'palace-draft-browser-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
