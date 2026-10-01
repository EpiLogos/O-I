// Required operator inputs name a real admitted native field and evidence
// destination. This is a native-backed browser replay, not installed acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const bridge=process.env.OI_KERNEL_BRIDGE,directory=process.env.OI_PRESENTATION_EVIDENCE;
assert.ok(bridge&&directory,'Supply the real admitted native bridge and bounded evidence directory');
const expression='expression:shared-continuation-20260930';
const guide='world:shared-expression:ann/artifact:shared-continuation-guide';
const owner=async request=>{
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'shared_field',request}),signal:AbortSignal.timeout(30000)});
 const reply=await response.json();assert.equal(reply.ok,true,reply.error);assert.equal(reply.outcome.result,'shared_field_reading');return reply.outcome.data;
};
const before=await owner({kind:'read',ref:expression});assert.equal(before.state,'hosted');
assert.ok(before.projections.some(row=>row.subject?.ref===expression&&row.state==='published'),'The real owner must admit this exact publication');
await mkdir(directory,{recursive:true});await writeFile(`${directory}/admitted-browser-before-owner.json`,JSON.stringify(before));
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/admitted-native',async(_request,response)=>{response.setHeader('content-type','text/html');response.end(await server.transformIndexHtml('/admitted-native','<!doctype html><html><body class="oi-desktop" style="margin:0"><div id="root" style="height:100vh"></div><script type="module" src="/tests/presentation-admitted-native-page.tsx"></script></body></html>'));});
let browser,page;const errors=[];
try{
 await server.listen();browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1400,height:1000}});
 await context.addInitScript(endpoint=>{if(window.top!==window)return;window.__OI_KERNEL_BRIDGE__=endpoint;localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false}));},bridge);
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/admitted-native`;
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const expressionButton=page.locator(`.explore-results [data-explore-ref="${expression}"] button`);await expressionButton.waitFor({timeout:60000});await expressionButton.click();
 await page.locator('.world-presentation__masthead h1').filter({hasText:before.entry.label}).waitFor({timeout:60000});
 const defaultNames=await page.locator('body').ariaSnapshot();
 for(const identity of [expression,guide,'world:shared-expression:ann/agent:expressed-88d11962e8c34c2ea8209169c93f7012'])assert.ok(!defaultNames.includes(identity),'Actual default accessibility names require human names, not canonical refs');
 assert.ok(defaultNames.includes('Shared continuation guide'),'The admitted native guide name is available');
 assert.doesNotMatch(defaultNames,/(?:thing|being) · central/);
 await writeFile(`${directory}/admitted-expression-after.aria.txt`,defaultNames);await page.screenshot({path:`${directory}/admitted-expression-after.png`,fullPage:true});
 const guideButton=page.locator('[data-component-ref="oi.presentation/reference-card/v1"][data-subject-ref]').filter({has:page.getByRole('button',{name:'Shared continuation guide',exact:true})}).getByRole('button',{name:'Shared continuation guide',exact:true}).first();
 await guideButton.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/admitted-named-guide-card-after.png`,fullPage:true});
 await guideButton.click();
 await page.locator(`.presentation-body[data-presentation-state="hosted"][data-entry-ref="${guide}"]`).waitFor({timeout:60000});
 assert.equal(await page.locator('.explore-surface').getAttribute('data-selected-ref'),guide,'Readable native guide action opens its exact admitted subject in production Explore');
 const guideReading=await owner({kind:'read',ref:guide});assert.equal(guideReading.state,'hosted');
 assert.ok((await page.locator('body').ariaSnapshot()).includes(guideReading.entry.label));
 await page.screenshot({path:`${directory}/admitted-guide-current-body.png`,fullPage:true});
 await page.getByRole('button',{name:'Source',exact:true}).click();
 const guideProjection=guideReading.projections.find(row=>row.projection_ref===guideReading.entry.meta.projection_ref);assert.ok(guideProjection);
 assert.ok((await page.locator('body').ariaSnapshot()).includes(guideProjection.source.ref),'Deliberate Source recovers the exact admitted source');
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.locator('.world-presentation__masthead h1').filter({hasText:before.entry.label}).waitFor({timeout:60000});
 assert.equal(await page.locator('.explore-surface').getAttribute('data-selected-ref'),expression);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.world-presentation__masthead h1').filter({hasText:before.entry.label}).waitFor({timeout:60000});
 assert.equal(await page.locator('.explore-surface').getAttribute('data-selected-ref'),expression,'Reopen preserves exact native selection');
 const after=await owner({kind:'read',ref:expression});assert.deepEqual(after.projections,before.projections,'Reading, selection, Source and reopening do not modify admitted publications');
 assert.deepEqual(errors,[],'Real native-backed production surface has no browser errors');
 await writeFile(`${directory}/admitted-browser-after-owner.json`,JSON.stringify(after));
 console.log('PASS actual admitted private publication -> real kernel/field client -> production Explore -> named native guide open, exact Source, Back and reopen. Installed acceptance remains separate.');
}catch(error){if(page){await writeFile(`${directory}/admitted-browser-failure.json`,JSON.stringify({error:String(error),errors,html:await page.content()},null,2));await page.screenshot({path:`${directory}/admitted-browser-failure.png`,fullPage:true});}throw error;}
finally{if(browser)await browser.close();await server.close();}
