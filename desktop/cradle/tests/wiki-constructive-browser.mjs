/** Real native UI walk: Central + AIKit + O:I kernel + production Wiki/Stage.
 * Controlled temporary ground, no transport fixtures, models or owner machine.
 */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'tests/artifacts/wiki-constructive');mkdirSync(out,{recursive:true});
const binaries=Object.fromEntries(['OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','WIKI_KERNEL_BIN'].map(key=>{assert.ok(process.env[key],`${key} must name the actual built executable`);return [key,resolve(process.env[key])];}));
const ground=mkdtempSync(resolve(tmpdir(),'wiki-constructive-')),project=resolve(ground,'Work/Notes');mkdirSync(project,{recursive:true});
const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:resolve(ground,'isolated-home'),AIKIT_HOME:resolve(ground,'isolated-aikit'),...binaries,OI_CENTRAL_ROOT:ground,OI_CENTRAL_PROJECT_QUERY:'Notes'};
mkdirSync(env.HOME,{recursive:true});
const receipt={scope:'N+B: real CLI, files, dev kernel and production UI on a controlled temporary ground; no installed, live-model or human acceptance',checks:[],native:[],passed:false};
const check=(truth,label)=>{assert.ok(truth,label);receipt.checks.push(label);console.log('PASS',label);};
function action(name,input={}){const result=JSON.parse(execFileSync(binaries.OI_CENTRAL_CTRL_BIN,['--json','--root',ground,'action','run',name,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(result.ok,true,JSON.stringify(result));receipt.native.push({action:name,status:result.status});return result.data;}
action('central.init');action('projectcentral.init',{project:'Notes',project_id:'wiki-native-walk'});
const sourceText='# Alpha\n\n🌱 **A first reading.**\n\n> A complementary reading.\n\n[[Beta]]\n';
const sourceMaterial=[['a','Alpha',sourceText],['b','Beta','# Beta\n\n[[Alpha]]\n']].map(([key,title,body])=>({binding:{source:`source:${key}`,revision:'r1',title,tags:['notes'],visibility:'public',owners:[],media_type:'text/markdown',locator:{kind:'path',value:resolve(project,`${key}.md`)},metadata:{}},body}));
const materialPath=resolve(project,'source-material.json');writeFileSync(materialPath,JSON.stringify(sourceMaterial));
for(const item of sourceMaterial)writeFileSync(item.binding.locator.value,item.body);
const before=readFileSync(materialPath,'utf8'),wikiPath=resolve(project,'ProjectCentral/agents/wiki/wiki.json');
let bridge,server,browser,page,bridgeUrl;const logs=[],errors=[],writes=[],responses=[];
async function startBridge(){
 bridge=spawn(binaries.WIKI_KERNEL_BIN,['127.0.0.1:0'],{cwd:project,env,stdio:['ignore','pipe','pipe']});
 bridge.stderr.on('data',data=>logs.push(data.toString()));
 bridgeUrl=await new Promise((yes,no)=>{let data='';const timer=setTimeout(()=>no(new Error('The actual kernel did not become available')),30000);bridge.on('error',error=>{clearTimeout(timer);no(new Error(`Kernel could not start: ${error.message}`));});bridge.on('exit',code=>{clearTimeout(timer);no(new Error(`Kernel exited ${code}: ${logs.slice(-5)}`));});bridge.stdout.on('data',chunk=>{data+=chunk;const match=data.match(/listening on (http:\/\/[^ ]+)/);if(match){clearTimeout(timer);yes(match[1]);}});});
}
async function op(value){const response=await fetch(`${bridgeUrl}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));return result.outcome;}
function savedFrame(title){return JSON.parse(readFileSync(wikiPath,'utf8')).objects.find(object=>object.object==='frame'&&object['aikit.constellation/v1']?.title===title);}
async function choosePassage(selector){await page.locator(selector).evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});await page.getByRole('button',{name:'Add to constellation',exact:true}).click();}
try{
 await startBridge();
 const actual=await op({op:'knowledge',project:'Notes',request:{action:'read',address:{kind:'source',value:'source:a'}}});
 check(actual.result==='knowledge'&&actual.data.document?.schema==='aikit.markdown-reading/v1','The actual native owner supplies the Markdown reading');
 server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{three:resolve(root,'node_modules/three')}},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});await server.listen();
 const url=`http://127.0.0.1:${server.httpServer.address().port}/tests/wiki-constructive.html?bridge=${encodeURIComponent(bridgeUrl)}`;
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1360,height:960},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('response',response=>{if(response.request().method()==='POST'&&response.url().endsWith('/op'))void response.json().then(result=>{if(result.error||result.ok===false)responses.push(result);},()=>{});});
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/op')){const body=request.postDataJSON();if(body.op==='invoke_action'||body.op==='expression')writes.push(body);}});
 await page.goto(url);await page.locator('.wiki-prose h1').waitFor();
 await choosePassage('.wiki-prose strong');
 const drawer=page.getByRole('complementary',{name:'Constellation authoring'});
 await drawer.getByLabel('Constellation title').fill('Native passage inquiry');await drawer.getByLabel('Constellation inquiry').fill('How do these two readings qualify each other?');
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Constellation frame"] option[value^="ql:"]').length>0);
 const form=await drawer.locator('[aria-label="Constellation frame"] option[value^="ql:"]').first().getAttribute('value');
 await drawer.getByLabel('Constellation frame').selectOption(form);
 await drawer.getByLabel('Role for member 1').selectOption({index:1});
 await drawer.getByRole('button',{name:'Close constellation authoring'}).click();
 await choosePassage('.wiki-prose blockquote');
 await drawer.getByLabel('Role for member 2').selectOption({index:2});
 await drawer.getByRole('button',{name:'Add connection',exact:true}).click();await drawer.getByLabel('Meaning of connection 1').fill('qualifies');
 await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();
 await drawer.getByText('Saved and found through native Wiki/search.',{exact:true}).waitFor();
 let frame=savedFrame('Native passage inquiry');const wholeRef=frame.ref;
 check(frame.constellations[0].members.length===2,'Reader selection saves a native two-member constellation');
 const members=frame.constellations[0].members;
 check(members[0].ref===members[1].ref&&members[0]['aikit.constellation-participation/v1'].participation_ref!==members[1]['aikit.constellation-participation/v1'].participation_ref,'Two passages retain one source identity and two contextual participations');
 check(readFileSync(materialPath,'utf8')===before,'Constellation authoring leaves the original linked writing unchanged');
 const graph=await op({op:'graph',project:'Notes',query:'',options:{input:'aikit_resolution',fresh:true}});
 check(graph.reading.edges.some(edge=>edge.family==='ql-authored'&&edge.relation==='qualifies'),'Authored QL relation is read back through the actual Wiki graph');
 check(graph.reading.formations.some(formation=>formation.ref===wholeRef&&formation.members.length===2),'Native formation is discoverable without collapsing whole/member structure');
 await drawer.getByRole('button',{name:'Open live composition',exact:true}).click();
 await drawer.getByText('The live constellation is rendered. Select a body or relation to inspect its native identity.',{exact:true}).waitFor();
 await page.screenshot({path:resolve(out,'live-constellation.png')});
 await drawer.getByRole('button',{name:'Edit glyphs, text, media and motion',exact:true}).click();
 const composer=page.getByRole('region',{name:'Expression composition'});await composer.waitFor();
 const expressionRef=await composer.getAttribute('data-expression-ref');
 await composer.getByLabel('Entity x',{exact:true}).fill('173');await composer.getByLabel('Entity x',{exact:true}).press('Enter');
 await page.waitForTimeout(150);
 await composer.getByLabel('Glyph',{exact:true}).fill('∴');await composer.getByLabel('Glyph',{exact:true}).press('Enter');
 await page.waitForTimeout(150);
 const edited=await op({op:'expression',request:{operation:'inspect',expression_ref:expressionRef}});
 check(Object.values(edited.data.document.entities).some(entity=>entity.parameters.x?.value===173&&entity.parameters.glyph?.value==='∴'),'The production composer edits the actual 3D body and glyph');
 check(Object.keys(edited.data.document.relations).length===1,'The live Expression carries the actual native typed relationship');
 await page.getByRole('button',{name:'Return to Wiki',exact:true}).click();
 await drawer.getByText('Save and Return composition',{exact:true}).click();
 await drawer.getByLabel('Expression destination folder').fill('Work/Notes');await drawer.getByLabel('Expression filename').fill('inquiry.expression.json');
 await drawer.getByRole('button',{name:'Save Expression file',exact:true}).click();
 await drawer.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).waitFor();
 await drawer.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).click();
 await drawer.getByRole('button',{name:'Returned to constellation',exact:true}).waitFor();
 const artifact=JSON.parse(readFileSync(resolve(project,'inquiry.expression.json'),'utf8'));
 check(artifact.expression_ref===expressionRef&&Object.values(artifact.entities).some(entity=>entity.parameters.x?.value===173),'The actual saved artifact preserves the human-edited composition');
 frame=savedFrame('Native passage inquiry');check(frame['aikit.constellation/v1'].compositions[0].reference===expressionRef,'The saved composition Returns to its actual native constellation');
 // Stop the kernel, not just the page. Reopen is tested in another process.
 bridge.kill('SIGTERM');await new Promise(resolve=>bridge.once('exit',resolve));await startBridge();
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/wiki-constructive.html?bridge=${encodeURIComponent(bridgeUrl)}`);
 await page.locator('.wiki-prose h1').waitFor();await page.getByRole('button',{name:'Constellations',exact:true}).click();
 await drawer.getByText(/expression · r/).last().click();await composer.waitFor();
 check(await composer.getAttribute('data-expression-ref')===expressionRef,'A returned composition reopens from its native artifact after a kernel restart');
 await page.getByRole('button',{name:'Return to Wiki',exact:true}).click();
 // Frame-first is a native save with no fabricated source members.
 await drawer.getByRole('button',{name:'New inquiry',exact:true}).click();
 await drawer.getByLabel('Constellation title').fill('Frame before material');await drawer.getByLabel('Constellation inquiry').fill('What belongs in these open roles?');
 await drawer.getByLabel('Constellation frame').selectOption(form);await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();
 await drawer.getByText('Saved and found through native Wiki/search.',{exact:true}).waitFor();
 check(savedFrame('Frame before material').constellations[0].members.length===0,'Frame-first creation retains genuinely open roles');
 await drawer.getByRole('button',{name:'Close constellation authoring'}).click();await choosePassage('.wiki-prose strong');
 const prior=readFileSync(wikiPath,'utf8');sourceMaterial[0].binding.revision='r2';sourceMaterial[0].body=sourceText+'\nChanged externally.\n';writeFileSync(materialPath,JSON.stringify(sourceMaterial));
 await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();await drawer.getByRole('alert').filter({hasText:'Source changed'}).waitFor();
 check(readFileSync(wikiPath,'utf8')===prior,'A stale source selection is refused without changing the saved constellation');
 await page.reload();await page.getByRole('button',{name:'Constellations',exact:true}).click();
 check(await drawer.locator('.wiki-construction-members li').count()===1,'The refused proposal survives reload for reconciliation');
 await page.setViewportSize({width:420,height:800});await page.screenshot({path:resolve(out,'narrow-recovery.png')});
 check(errors.length===0,`No uncaught UI errors (${errors.join('; ')})`);
 receipt.passed=true;receipt.expression_ref=expressionRef;receipt.frame_ref=wholeRef;receipt.operations=writes.length;
 console.log(JSON.stringify(receipt));
}catch(error){receipt.failure={message:String(error),errors,responses,lastWrites:writes.slice(-4),authoring:page?await page.locator('.wiki-construction').innerText().catch(()=>null):null};console.error(JSON.stringify(receipt.failure));if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');writeFileSync(resolve(out,'kernel.log'),logs.join(''));if(browser)await browser.close();if(server)await server.close();bridge?.kill('SIGTERM');}
