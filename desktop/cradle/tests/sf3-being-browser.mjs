/** Hosted/native SF3 desktop walk. Provision with
 * `tsx shared-field/spacetimedb/sf3-being-hosted-provision.ts`, run this with
 * the returned participant ref and OI_SF3_DECISION=rejected, publish the real
 * native revision with `sf3-being-hosted-reproject.ts`, then run this again
 * with OI_SF3_DECISION=accepted. The caller supplies an official ACP-backed
 * AIKit Encounter owner through OI_SHARED_AGENT_CONTROLLER. */
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
const sourceWorld=process.env.OI_SF3_SOURCE_WORLD;if(!sourceWorld)throw new Error('OI_SF3_SOURCE_WORLD must name a disposable run-scoped source world');const cargoTarget=process.env.OI_SF3_CARGO_TARGET_DIR;if(!cargoTarget)throw new Error('OI_SF3_CARGO_TARGET_DIR must name an isolated run-scoped Cargo target');
const participantRef=process.env.OI_SF3_PARTICIPANT_REF;
const instruction=process.env.OI_SF3_INSTRUCTION;
const decision=process.env.OI_SF3_DECISION;
if((instruction||decision)&&(!participantRef||!instruction||!['accepted','rejected'].includes(decision)))throw new Error('OI_SF3_PARTICIPANT_REF, OI_SF3_INSTRUCTION and accepted/rejected OI_SF3_DECISION are required together');
let browser;
try{
 start('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--','127.0.0.1:4283'],{CARGO_TARGET_DIR:cargoTarget,OI_REPO_ROOT:repoRoot});
 start('./node_modules/.bin/vite',['--host','127.0.0.1','--port','4273','--strictPort'],{VITE_KERNEL_BRIDGE:bridge});
 await Promise.all([wait(`${bridge}/state`),wait(app)]);browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});const ops=[];page.on('request',request=>{if(request.url().endsWith('/op')&&request.method()==='POST')ops.push(request.postDataJSON());});page.on('pageerror',error=>console.error(error));
 await page.goto(app);await page.locator('.oi-welcome-enter').click().catch(()=>{});const chooser=page.getByRole('region',{name:'Central location'});if(await chooser.isVisible().catch(()=>false))await bindDefaultCentral(page,sourceWorld);await page.getByRole('button',{name:'Open Explore',exact:true}).click();const explore=page.getByRole('region',{name:'Explore'});const node=participantRef?explore.locator(`.explore-node--being[data-explore-ref="${participantRef}"]`):explore.locator('.explore-node--being').first();await node.waitFor({state:'attached',timeout:30000});
 const before=ops.filter(op=>op.op==='encounter'||op.op==='being_encounter').length;await node.focus();await node.press('Enter');const being=explore.locator('.being-encounter');try{await being.waitFor();}catch(error){console.error({selected:await explore.getAttribute('data-selected-ref'),text:(await explore.innerText()).slice(-1200)});throw error;}assert.ok(await being.getAttribute('data-being-ref'));assert.ok(await being.getByText('Presence, membership, addressing, invocation authority and attention remain separate.').count());assert.equal(ops.filter(op=>op.op==='encounter').length,0,'opening a Being starts no personal AgentSession');assert.equal(ops.filter(op=>op.op==='being_encounter').length-before<=1,true,'only the native standing read may occur');
 if(instruction){await being.getByRole('textbox',{name:/Request for/}).fill(instruction);await being.getByRole('button',{name:'Invoke Agent'}).click();const action=decision==='accepted'?'Accept Agent refinement':'Reject Agent refinement';await being.getByRole('button',{name:action}).waitFor({timeout:150000});const proposal=await being.locator('.being-review').innerText();assert.match(proposal,/Native proposal/);assert.match(proposal,/entity_add/);const returned=JSON.parse(await being.locator('.being-invocation-result pre').innerText());await being.getByRole('button',{name:action}).click();await page.waitForTimeout(250);console.log(JSON.stringify({schema:'oi.sf3-browser-receipt/v1',participant_ref:participantRef,decision,proposal,delivery:returned.delivery,personal_agent_encounter_operations:ops.filter(op=>op.op==='encounter').length}));}
 else console.log(`SF3 hosted Being presence walk passed against ${process.env.OI_SHARED_FIELD_TARGET}: ${await being.getAttribute('data-being-ref')}`);
}finally{await browser?.close();children.reverse().forEach(child=>child.kill('SIGTERM'));}
