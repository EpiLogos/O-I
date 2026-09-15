/** Hosted/native SF3 desktop walk. Requires OI_SHARED_FIELD_TARGET and reads
 * the real second-world snapshot; it creates no fixture participant. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {bindDefaultCentral} from '../walk/editor-doc.mjs';
import {fileURLToPath} from 'node:url';
const bridge='http://127.0.0.1:4283',app='http://127.0.0.1:4273',children=[];
const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const start=(cmd,args,env)=>{const child=spawn(cmd,args,{cwd:new URL('../',import.meta.url),env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);return child;};
const wait=async url=>{const until=Date.now()+180000;while(Date.now()<until){try{if((await fetch(url)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error(`Timed out waiting for ${url}`);};
if(!process.env.OI_SHARED_FIELD_TARGET)throw new Error('OI_SHARED_FIELD_TARGET is required');
const sourceWorld=process.env.OI_SF3_SOURCE_WORLD;if(!sourceWorld)throw new Error('OI_SF3_SOURCE_WORLD must name a disposable run-scoped source world');
let browser;
try{
 start('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--','127.0.0.1:4283'],{CARGO_TARGET_DIR:process.env.OI_SF3_CARGO_TARGET_DIR??'/Users/admin/Central/Work/O-I/ProjectCentral/now/tmp/sf3-browser-target',OI_REPO_ROOT:repoRoot});
 start('./node_modules/.bin/vite',['--host','127.0.0.1','--port','4273','--strictPort'],{VITE_KERNEL_BRIDGE:bridge});
 await Promise.all([wait(`${bridge}/state`),wait(app)]);browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});const ops=[];page.on('request',request=>{if(request.url().endsWith('/op')&&request.method()==='POST')ops.push(request.postDataJSON());});page.on('pageerror',error=>console.error(error));
 await page.goto(app);await page.locator('.oi-welcome-enter').click().catch(()=>{});const chooser=page.getByRole('region',{name:'Central location'});if(await chooser.isVisible().catch(()=>false))await bindDefaultCentral(page,sourceWorld);await page.getByRole('button',{name:'Open Explore',exact:true}).click();const explore=page.getByRole('region',{name:'Explore'});const node=explore.locator('.explore-node--being').first();await node.waitFor({state:'attached',timeout:30000});
 const before=ops.filter(op=>op.op==='encounter'||op.op==='being_encounter').length;await node.focus();await node.press('Enter');const being=explore.locator('.being-encounter');try{await being.waitFor();}catch(error){console.error({selected:await explore.getAttribute('data-selected-ref'),text:(await explore.innerText()).slice(-1200)});throw error;}assert.ok(await being.getAttribute('data-being-ref'));assert.ok(await being.getByText('Presence, membership, addressing, invocation authority and attention remain separate.').count());assert.equal(ops.filter(op=>op.op==='encounter').length,0,'opening a Being starts no personal AgentSession');assert.equal(ops.filter(op=>op.op==='being_encounter').length-before<=1,true,'only the native standing read may occur');
 console.log(`SF3 hosted Being presence walk passed against ${process.env.OI_SHARED_FIELD_TARGET}: ${await being.getAttribute('data-being-ref')}`);
}finally{await browser?.close();children.reverse().forEach(child=>child.kill('SIGTERM'));}
