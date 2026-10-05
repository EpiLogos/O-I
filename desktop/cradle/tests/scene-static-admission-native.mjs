/** Real GPU receiving diagnosis using an acknowledged native Epi Scene.
 * This component proof locates paused scene admission; it is neither ordinary
 * application loading nor installed encounter acceptance.
 * Config: {owner_reply_file, output, expect_seeded}.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.argv[2]);
const config=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
const output=resolve(config.output);await mkdir(output,{recursive:true});
const original=await readFile(config.owner_reply_file);
const reply=JSON.parse(original),document=reply.response.outcome.data.document;
assert.equal(document.schema,'oi.expression/v1');
const scene=document.scenes.find(s=>s.presentation?.scene?.epiWorld)?.presentation.scene;
assert.ok(scene&&scene.entities.length===32);
const production=resolve(root,'expressions-app/field-studies-journeys/src/production.ts');
const sourceBytes=await readFile(production);await writeFile(resolve(output,'production-source.ts'),sourceBytes);
const code=`import {ProductionAdapter} from './expressions-app/field-studies-journeys/src/production';
import {blankScene,clone} from './expressions-app/field-studies-journeys/src/model';
window.run=async function(scene){
 const canvas=document.querySelector('canvas'),a=new ProductionAdapter(canvas);a.resize(1200,960,1);
 const frame=s=>({scene:s,simTime:0,delta:0,params:{},camera:{...s.view,plane:'XY',depth:0,grid:false,snap:false},pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[],scaffold:'off'});
 const first=blankScene('Actual paused predecessor');first.id='diagnostic:predecessor';first.field.params.count=scene.field.params.count;first.entities=[];
 const render=s=>a.render(frame(s));render(first);render(scene);
 for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,20));render(scene);if(Object.values(a.telemetry().sourceStatus).every(v=>v.includes('source active')))break;}
 if(!Object.values(a.telemetry().sourceStatus).every(v=>v.includes('source active')))throw Error('Actual encoded sources did not become active');
 const stats=()=>{const p=a.inspect(true),target=a.engine.entities.buildSeed();let max=0,mismatch=0;for(let i=0;i<p.positions.length;i+=4){const d=Math.hypot(...[0,1,2].map(k=>p.positions[i+k]-target[i+k]));max=Math.max(max,d);if(d>.001)mismatch++;}return{simTime:p.simTime,steps:p.steps,seeds:p.seeds,particleCount:p.particleCount,partitions:p.partitions.map(p=>({entityId:p.entityId,start:p.start,end:p.end})),target_max_gap:max,target_mismatches:mismatch,sourceStatus:a.telemetry().sourceStatus};};
 const before=stats(),beforeImage=a.capture(1200,960).toDataURL();
 // A documented owner reset is a discriminating intervention, not a claimed
 // production repair. It leaves simulation time, all native subjects and
 // every material target unchanged while exposing the lost receiving effect.
 a.engine.seedCurrentTargets();render(scene);const intervention=stats(),afterImage=a.capture(1200,960).toDataURL();
 const continuity=a.inspect(true),edited=clone(scene);edited.view={...edited.view,yaw:.15};render(edited);const camera=a.inspect(true);
 const invariant=JSON.stringify(continuity.positions)===JSON.stringify(camera.positions)&&continuity.seeds===camera.seeds&&continuity.simTime===camera.simTime;
 const gl=canvas.getContext('webgl2'),gpu=gl?.getParameter(gl.RENDERER);
 a.dispose();return{before,intervention,camera_keeps_resident_positions:invariant,gpu,images:{before:beforeImage,intervention:afterImage}};
};`;
await build({stdin:{contents:code,resolveDir:root},bundle:true,platform:'browser',format:'esm',outfile:resolve(output,'probe.js'),logLevel:'warning'});
const bundle=await readFile(resolve(output,'probe.js'));
const server=createServer((req,res)=>{if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);}else res.end('<style>body{margin:0;background:#10191c}canvas{width:1200px;height:960px}</style><canvas></canvas><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const receipt={schema:'oi.scene-static-admission-native-proof/v1',pass:false,scope:'Actual production adapter/PointCloud GPU over native acknowledged Scene; component receiving diagnosis only; ordinary/installed proofs remain separate',owner_reply:{path:config.owner_reply_file,sha256:createHash('sha256').update(original).digest('hex')},production_sha256:createHash('sha256').update(sourceBytes).digest('hex'),expression_ref:document.expression_ref,revision:document.revision,expected_automatic_admission:config.expect_seeded};
try{browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:960}});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.run);const result=await page.evaluate(s=>window.run(s),scene);for(const [name,data] of Object.entries(result.images))await writeFile(resolve(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));delete result.images;Object.assign(receipt,result,{browser:browser.version()});assert.equal(result.before.simTime,0);assert.equal(result.before.partitions.length,32);assert.equal(result.intervention.target_mismatches,0,'The actual documented owner intervention must receive all current targets');assert.equal(result.camera_keeps_resident_positions,true,'Camera change must retain resident state');if(config.expect_seeded)assert.equal(result.before.target_mismatches,0,'A newly opened paused Scene must receive its actual bodies without Play or Reset');else assert.ok(result.before.target_mismatches>0,'Preserve the old failed receiving effect');receipt.pass=true;console.log(JSON.stringify(receipt));}
finally{await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
