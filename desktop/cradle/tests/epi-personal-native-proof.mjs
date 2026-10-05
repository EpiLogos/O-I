/** Ordinary-production personal modal proof.
 * Caller owns the actual host server/bridge/browser and supplies acknowledged
 * saved-file snapshots. This helper opens only its own serial browser contexts.
 * It never constructs native data, pins a new occasion, changes private source,
 * installs, substitutes a component canvas, or claims hardware/audio acceptance.
 *
 * Import after native file acknowledgement in epi-world-production-native.mjs:
 *   await runPersonalModalConsumerProof({browser,url,worldA:afterNext,
 *     output:resolve(out,'personal-modal'),readOwner:nativeDocument,
 *     observePage,onPhase:label=>{phase=label;}});
 * Optional worldB is the second person's actual acknowledged saved snapshot;
 * geometry differences refuse the two-person causal comparison.
 */
import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sha=value=>createHash('sha256').update(value).digest('hex');
const FREQUENCIES=[126,210,141,221,145,184,148,207,211,140];
const CENTRES=[6,5,4,3,2,1,0,null,5,6];
const STEPS=240,DT=1/120,EXCITATION=.6,DOMINANCE=.25;
const fields=['positions','velocities','targets'];
const seed=0x13579bdf;
const jsonCopy=value=>JSON.parse(JSON.stringify(value));
const ORIENTATION_SHADER='vec3 qv=uLocalResOrientation.xyz;float qw=uLocalResOrientation.w;';
/** A mutation of the real compiled consumer, never a native response or ACK.
 * The identity cut retains every driver and deliberately ignores the input. */
export function orientationConsumerCounterproof(html,kind){
 assert.ok(['negated','identity-disconnected'].includes(kind));
 assert.equal(html.split(ORIENTATION_SHADER).length-1,1,'One exact actual orientation consumer is required');
 const replacement=kind==='negated'?'vec3 qv=-uLocalResOrientation.xyz;float qw=-uLocalResOrientation.w;':'vec3 qv=vec3(0.0);float qw=1.0;';
 const changed=html.replace(ORIENTATION_SHADER,replacement);
 assert.equal(changed.replace(replacement,ORIENTATION_SHADER),html,'Only the declared orientation consumer may change');
 return changed;
}
/** Independent Hamilton rotation matrix and analytic intensity derivative.
 * This predicts the shader's spatial force from its actual float32 inputs; it
 * does not simulate a new knowledge coordinate or manufacture native current. */
export function predictLocalIntensityForce(position,frames,q,u){
 const {w,x,y,z}=q,R=[[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],
  [2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],
  [2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]];
 const force=[0,0,0];
 for(const frame of frames){
  const offset=position.map((v,i)=>v-Math.fround(frame.position[i]));
  const local=[0,1,2].map(i=>R.reduce((sum,row,j)=>sum+row[i]*offset[j],0));
  const L=Math.max(10,Math.fround(frame.params.plateSize));let Wr=0,Wi=0;
  const dr=[0,0,0],di=[0,0,0];
  for(let mode=0;mode<64;mode++){
   const ar=Math.fround(frame.re[mode]),ai=Math.fround(frame.im[mode]);if(Math.abs(ar)+Math.abs(ai)<1e-8)continue;
   let phi,gradient;
   if(frame.params.dimension==='3D'){
    const k=[Math.floor(mode/16)+1,Math.floor(mode%16/4)+1,mode%4+1].map(n=>n*Math.PI);
    const angle=k.map((v,i)=>v*(local[i]/L+.5)),c=angle.map(Math.cos),s=angle.map(Math.sin);
    phi=c[0]*c[1]*c[2];gradient=k.map((v,i)=>-v/L*s[i]*c[(i+1)%3]*c[(i+2)%3]);
   }else{
    const m=Math.floor(mode/8)+1,n=mode%8+1,sign=(m+n)%2===0?1:-1,axis=u.plane>.5?2:1;
    const a=local[0]/L,b=local[axis]/L,mp=m*Math.PI,np=n*Math.PI;
    phi=Math.cos(mp*a)*Math.cos(np*b)+sign*Math.cos(np*a)*Math.cos(mp*b);
    gradient=[(-mp*Math.sin(mp*a)*Math.cos(np*b)-sign*np*Math.sin(np*a)*Math.cos(mp*b))/L,0,0];
    gradient[axis]=(-np*Math.cos(mp*a)*Math.sin(np*b)-sign*mp*Math.cos(np*a)*Math.sin(mp*b))/L;
   }
   Wr+=ar*phi;Wi+=ai*phi;for(let i=0;i<3;i++){dr[i]+=ar*gradient[i];di[i]+=ai*gradient[i];}
  }
  const gradient=dr.map((v,i)=>2*(Wr*v+Wi*di[i])*u.driveScale);
  for(let i=0;i<3;i++)force[i]-=R[i].reduce((sum,v,j)=>sum+v*gradient[j],0)*u.transport*Math.max(0,Math.min(1,u.dominance));
 }
 force.forEach(finite);return force;
}
const finite=value=>assert.ok(Number.isFinite(value),'Nonfinite actual GPU/native value');
const actualScene=s=>s.document.scenes[s.state.sceneIndex];
const driverRows=s=>s.rendered.localizedResonance;
const lock=s=>({instance:s.record.world.instance_ref,person:s.record.person_ref,
 identity:s.record.identity_source,input:s.record.identity_input_revision,
 event:s.record.world.event_ref,snapshot:s.record.world.snapshot_ref,sky:s.record.world.sky,
 source:s.record.source_basis.source_revision,current_context:s.current.context,
 identity_reading:s.current.reading.identity,transit:s.current.reading.transit,
 baseline:s.current.reading.q_identity_transit,activity:s.current.reading.q_activity,
 composed:s.current.reading.q_composed,activity_status:s.current.reading.activity_status});
function material(s){const result=jsonCopy(actualScene(s));
 // Exactly the declared presentation intervention. Every other authored value
 // remains part of the comparison, including physics, centres and automations.
 delete result.field.params.excitation;return result;}
function ulp32(value){const buffer=new ArrayBuffer(4),view=new DataView(buffer);
 view.setFloat32(0,Math.abs(value));const bits=view.getUint32(0);
 if(bits>=0x7f7fffff)return Infinity;
 view.setUint32(0,bits+1);return view.getFloat32(0)-Math.fround(Math.abs(value));}
function partition(s,entity){const rows=s.rendered.partitions.filter(p=>p.entityId===entity);
 assert.equal(rows.length,1,'One actual resident body partition is required: '+entity);
 assert.ok(rows[0].end>rows[0].start,'Required body has no resident particles: '+entity);return rows[0];}
function samples(s,entity,key){const p=partition(s,entity),data=s.rendered[key];
 assert.ok(Array.isArray(data)&&data.length===s.rendered.particleCount*4,'Actual full GPU '+key+' is required');
 return data.slice(p.start*4,p.end*4);}
function difference(a,b){assert.equal(a.length,b.length,'GPU comparison dimensions differ');
 let max=0,total=0,changed=0,ulp=0;
 for(let i=0;i<a.length;i++){finite(a[i]);finite(b[i]);if(i%4===3)continue;
  const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);total+=d;if(d!==0)changed++;
  ulp=Math.max(ulp,ulp32(a[i]),ulp32(b[i]));}
 return{max,mean:total/(a.length/4*3),changed,components:a.length/4*3,float32_ulp_max:ulp};}
function pixelDifference(a,b){assert.equal(a.length,b.length);let absolute=0,changed=0,max=0;
 for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);absolute+=d;if(d)changed++;max=Math.max(max,d);}
 return{absolute,changed,max};}
function required(s){const p=s.record.receiving.personal;
 assert.equal(p.canonical_locus,'ql:m-coordinate:bimba:M4.4.4.4');
 assert.equal(s.record.world.instance_ref,s.working.native_ref);
 assert.equal(s.record.person_ref,s.current.reading.identity.person_ref);
 assert.equal(s.record.world.event_ref,s.current.context.event_ref);
 assert.equal(s.current.reading.transit.sky.snapshot_ref,s.record.world.snapshot_ref);
 assert.equal(s.current.reading.activity_status,'unavailable','This proof fixes unavailable activity');
 assert.equal(s.current.reading.q_activity,null);assert.equal(s.current.reading.q_composed,null);
 assert.equal(actualScene(s).id,s.working.native_ref+':scene:personal');
 assert.equal(actualScene(s).entities.length,9);assert.equal(s.rendered.partitions.length,9);
 assert.equal(actualScene(s).engine.resonanceEnabled,false,'Shared resonator must stay off');
 assert.equal(actualScene(s).field.params.dominance,DOMINANCE,'Positive authored mixture is required');
 assert.equal(s.telemetry.config.cymatics.dominance,DOMINANCE,'Actual receiving mixture is required');
 assert.equal(s.telemetry.config.cymatics.enabled,false,'Actual shared resonator must stay off');
 assert.ok(s.state.fieldPaused&&!s.state.playing&&!s.state.journeyPlaying,'Actual scene must remain held');
 assert.equal(s.native.status,'manual');assert.equal(s.native.lease,null);assert.equal(s.native.domain,null);
 assert.equal(p.centre_entity_refs.length,7);
 const expected=[s.working.native_ref+':entity:world-earth',...p.centre_entity_refs,p.locus_entity_ref];
 assert.equal(new Set(expected).size,9);
 assert.deepEqual(new Set(actualScene(s).entities.map(e=>e.id)),new Set(expected));
 for(const entity of expected)partition(s,entity);
 return p.centre_entity_refs;
}
function validateDrivers(s,excitation,positive){const rows=s.current.reading.identity.natal_composition.planetary_contributions;
 assert.equal(rows.length,10);const denominator=rows.reduce((sum,r)=>sum+r.weighted_contribution,0);
 assert.ok(denominator>0);assert.equal(driverRows(s).length,9);
 assert.equal(new Set(driverRows(s).map(r=>r.driverRef)).size,9);
 assert.equal(new Set(driverRows(s).map(r=>r.entityId)).size,7);
 for(const row of rows){assert.equal(row.receiving_centre_ordinal,CENTRES[row.native_planet_id]);
  assert.equal(row.native_cousto_frequency_hz,FREQUENCIES[row.native_planet_id]);
  if(row.receiving_centre_ordinal===null){assert.equal(row.body,'Uranus');continue;}
  const frame=driverRows(s).find(r=>r.driverRef===JSON.stringify([s.record.identity_source.source_ref,row.native_planet_id]));
  assert.ok(frame,'Missing exact protected planetary driver '+row.body);
  assert.equal(frame.entityId,s.record.receiving.personal.centre_entity_refs[row.receiving_centre_ordinal]);
  assert.equal(frame.frequencyHz,row.native_cousto_frequency_hz);
  const expected=excitation*row.weighted_contribution/denominator;
  assert.ok(Math.abs(frame.params.driveStrength-expected)<=8*Number.EPSILON*Math.max(1,expected),'Native share was altered rather than live excitation');
  for(const v of [...frame.re,...frame.im,...frame.position])finite(v);
  if(positive)assert.ok([...frame.re,...frame.im].some(v=>v!==0),'Admitted positive driver has no resident modal amplitude');
  else assert.ok([...frame.re,...frame.im].every(v=>v===0),'Released zero-drive baseline retained modal history');
 }
}
function invariantDrivers(s){return driverRows(s).map(row=>{const r=jsonCopy(row);
 delete r.re;delete r.im;delete r.params.driveStrength;return r;});}

export async function runPersonalModalConsumerProof({browser,url,worldA,worldB=null,output,readOwner,qualification=null,observePage=()=>{},onPhase=()=>{}}){
 assert.ok(browser&&typeof readOwner==='function','Caller must supply actual browser and native owner readback');
 assert.ok(worldA?.working?.file?.revision&&worldA?.record,'Actual acknowledged saved world is required');
 const out=resolve(output);assert.ok(!existsSync(resolve(out,'receipt.json')),'Retain prior proof; use a new output directory');
 mkdirSync(out,{recursive:true});
 const receipt={schema:'oi.epi-personal-positive-live-zero/v1',passed:false,
  standing:'Unexecuted until every actual assertion finishes',
  scope:'Ordinary production file/UI, protected native current and actual resident GPU; same-nine-driver live excitation intervention. No installed/hardware/audio/source numerical parity/H claim.',
  verifier:{path:fileURLToPath(import.meta.url),sha256:sha(readFileSync(fileURLToPath(import.meta.url)))},
  qualification,supplied_native_cut_standing:'Caller-owned exact bridge/all-five manifest; helper separately captures actual loaded application and native owner readback in each trial',
  fixed:{seed,steps:STEPS,delta:DT,excitation:EXCITATION,dominance:DOMINANCE},trials:[],checks:[],artifacts:[]};
 const save=()=>writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 const artifact=(name,value)=>{writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');receipt.artifacts.push(name);};
 const passed=label=>{receipt.checks.push(label);save();};save();
 const results=[];
 async function trial(world,name,excitation,waves,orientationConsumer='native'){
  onPhase('personal modal '+name);
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(initial=>{let state=initial;Math.random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};},seed);
  const page=await context.newPage();page.setDefaultTimeout(40000);observePage(page);
  let frame,excitationChanged=false,consumerReceipt=null;
  if(orientationConsumer!=='native')await page.route('**/__epi_application*',async route=>{
   assert.equal(route.request().resourceType(),'document','Only the actual application HTML may be intervened upon');
   const response=await route.fetch(),original=await response.text();assert.equal(response.status(),200);
   const changed=orientationConsumerCounterproof(original,orientationConsumer);
   assert.equal(consumerReceipt,null,'One actual application admission per counterproof');
   const bundle=text=>{const match=text.match(/<script id="app-bundle">([\s\S]*?)<\/script>/);assert.ok(match);return match[1];};
   consumerReceipt={kind:orientationConsumer,original_html_sha256:sha(original),changed_html_sha256:sha(changed),original_bundle_sha256:sha(bundle(original)),changed_bundle_sha256:sha(bundle(changed)),native_response_intervention:false};
   writeFileSync(resolve(out,name+'-actual-original-application.html'),original);writeFileSync(resolve(out,name+'-actual-consumer-intervention.html'),changed);
   receipt.artifacts.push(name+'-actual-original-application.html',name+'-actual-consumer-intervention.html');
   await route.fulfill({response,body:changed});
  });
  const shot=async label=>{await page.screenshot({path:resolve(out,name+'-'+label+'.png')});receipt.artifacts.push(name+'-'+label+'.png');};
  const read=()=>frame.evaluate(()=>{const f=window.__FIELD_STUDIES__;return{state:f.getState(),working:f.nativeWorking(),record:f.epiWorld(),current:f.epiCurrent(),native:f.native(),document:f.getDocument(),rendered:f.inspect(true),telemetry:f.telemetry()};});
  const alert=async()=>assert.deepEqual((await frame.locator('.epi-world-entrance [role="alert"], .nara-personal-error, .nara-instrument [role="alert"]').allTextContents()).filter(v=>v.trim()),[],'Actual native/UI refusal');
  const settled=async()=>{await frame.waitForFunction(()=>!window.__FIELD_STUDIES__.nativeWorking()?.pending);await alert();};
  const composition=async()=>{
   await frame.locator('[data-epi="identity"]').click();
   await frame.getByRole('button',{name:'Composition',exact:true}).click();
   const force=frame.getByRole('combobox',{name:'Natal force presentation'});
   assert.ok(await force.isEnabled(),'Saved world identity was not hydrated into Nara local selection');
   return{force,waves:frame.getByRole('checkbox',{name:'Enter the current standing-wave field'})};
  };
  const closeNara=()=>frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();
  const tune=async value=>{
   await frame.evaluate(()=>window.__FIELD_STUDIES__.openEditor('field'));
   const group=frame.locator('[data-detail="resonance"]');
   if(!await group.evaluate(e=>e.open))await group.locator(':scope > summary').click();
   const control=group.locator('input[type="number"][data-bind="field.params.excitation"]');
   assert.equal(await control.count(),1,'One actual live excitation numeric control is required');
   await control.fill(String(value));await control.press('Enter');await control.blur();
   await frame.waitForFunction(v=>{const f=window.__FIELD_STUDIES__,s=f.getDocument().scenes[f.getState().sceneIndex];return s.field.params.excitation===v&&f.telemetry().config.cymatics.driveStrength===v;},value);
   await settled();
  };
  try{
   const target=new URL(url);target.searchParams.delete('expression');
   await page.goto(target.toString());
   await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});
   frame=await page.locator('#world').elementHandle().then(e=>e.contentFrame());
   await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.openNativeFile,null,{timeout:90000});
   const opened=await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),world.working.file.location.path);
   assert.equal(opened,true,'Ordinary native file restore was not acknowledged');
   await frame.waitForFunction(person=>{const f=window.__FIELD_STUDIES__;return f.epiWorld()?.person_ref===person&&f.epiCurrent()?.reading?.identity?.person_ref===person&&!f.nativeWorking()?.pending;},world.record.person_ref,{timeout:180000});
   await alert();await frame.evaluate(()=>window.__FIELD_STUDIES__.pause());
   const sceneRef=world.working.native_ref+':scene:personal';
   if((await read()).document.scenes[(await read()).state.sceneIndex].id!==sceneRef){
    await frame.locator(`[data-epi-scene="${sceneRef}"]`).click();
    await frame.waitForFunction(ref=>{const f=window.__FIELD_STUDIES__;return f.getDocument().scenes[f.getState().sceneIndex].id===ref;},sceneRef);
   }
   await settled();const opening=await read();required(opening);
   assert.equal(opening.working.native_ref,world.working.native_ref);assert.equal(opening.working.file.revision,world.working.file.revision);
   assert.equal(opening.record.world.event_ref,world.record.world.event_ref);assert.equal(opening.record.world.snapshot_ref,world.record.world.snapshot_ref);
   assert.deepEqual(opening.record.identity_source,world.record.identity_source);assert.deepEqual(opening.record.world.sky,world.record.world.sky);
   assert.equal(actualScene(opening).field.params.excitation,EXCITATION,'Read the actual authored positive input before controls');
   artifact(name+'-opening.json',opening);await shot('opening-before-controls');
   const environment=await frame.evaluate(()=>{const canvas=document.getElementById('field-canvas'),g=canvas.getContext('webgl2');if(!g)throw Error('Actual field WebGL2 required');const d=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),vendor:d?g.getParameter(d.UNMASKED_VENDOR_WEBGL):g.getParameter(g.VENDOR),renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),max_texture_units:g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS),max_fragment_uniform_vectors:g.getParameter(g.MAX_FRAGMENT_UNIFORM_VECTORS)};});
   if(receipt.environment)assert.deepEqual(environment,receipt.environment,'Trials ran on different actual rendering backends');
   else receipt.environment={...environment};
   const application=await frame.evaluate(()=>{const bundle=document.getElementById('app-bundle');if(!bundle?.textContent)throw Error('The actual ordinary production bundle is absent');return{url:location.href,bundle:bundle.textContent};});
   const bundleHash=sha(application.bundle);
   if(orientationConsumer==='native'){
    if(receipt.loaded_application_sha256)assert.equal(bundleHash,receipt.loaded_application_sha256,'Production code changed between causal trials');
    else receipt.loaded_application_sha256=bundleHash;
   }else{
    assert.ok(consumerReceipt,'Actual application consumer intervention was not observed');
    assert.equal(consumerReceipt.original_bundle_sha256,receipt.loaded_application_sha256,'Counterproof did not receive the same real original application');
    assert.equal(bundleHash,consumerReceipt.changed_bundle_sha256,'The declared actual consumer was not loaded');
    artifact(name+'-consumer-intervention.json',consumerReceipt);
   }
   artifact(name+'-environment.json',{browser_version:browser.version(),browser_launch_flags_custody:'Caller records actual launch flags; helper does not infer hardware or headless from backend',reduced_motion:'reduce',host_url:page.url(),app_url:application.url,actual_dom_app_bundle_sha256:bundleHash,gpu:environment});
   // Turn the actual projection off before reset. A particle reset alone does
   // not rewind independently retained modal envelopes.
   let ui=await composition();await ui.force.selectOption('');
   await frame.waitForFunction(()=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===0);
   await ui.force.selectOption('direct-planetary-resonance');
   if(await ui.waves.isChecked())await ui.waves.uncheck();
   await closeNara();await tune(excitation);excitationChanged=excitation!==EXCITATION;
   ui=await composition();assert.ok(await ui.waves.isEnabled(),'The selected saved person has no actual protected current');
   if(waves)await ui.waves.check();else if(await ui.waves.isChecked())await ui.waves.uncheck();
   await closeNara();await frame.evaluate(()=>{const f=window.__FIELD_STUDIES__;f.pause();f.command({type:'reset-field'});});
   await frame.waitForFunction(count=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===count,waves?9:0);
   await settled();const initial=await read();required(initial);
   assert.equal(initial.rendered.simTime,0);assert.equal(initial.rendered.steps,0);
   assert.deepEqual(lock(initial),lock(opening),'Personal determinants changed during the declared presentation intervention');
   assert.equal(initial.telemetry.config.cymatics.driveStrength,excitation);
   if(waves)validateDrivers(initial,excitation,false);else assert.equal(driverRows(initial).length,0);
   artifact(name+'-before.json',initial);
   await frame.evaluate(({steps,dt})=>window.__FIELD_STUDIES__.probeSteps(steps,dt),{steps:STEPS,dt:DT});
   const final=await read();required(final);assert.deepEqual(lock(final),lock(initial));
   let orientationUniforms=null;
   if(waves&&excitation>0){
    orientationUniforms=await frame.evaluate(()=>{
     const field=window.OI_DEBUG_ENGINE?.engine,sim=field?.simulator,renderer=sim?.renderer,material=sim?.velMaterial;
     if(!renderer||!material)throw Error('The actual loaded velocity material is unavailable');
     const program=renderer.properties.get(material).currentProgram?.program,gl=renderer.getContext();
     if(!program||!gl.isProgram(program))throw Error('The actual compiled GPU velocity program is unavailable');
     const uniform=name=>{const location=gl.getUniformLocation(program,name);if(location===null)return null;const value=gl.getUniform(program,location);return ArrayBuffer.isView(value)?Array.from(value):value;};
     return{orientation:uniform('uLocalResOrientation'),count:uniform('uLocalResCount'),transport:uniform('uLocalResTransport'),driveScale:uniform('uLocalResDriveScale'),dominance:uniform('uResDominance'),plane:uniform('uCompPlane'),host_orientation:material.uniforms.uLocalResOrientation.value.toArray()};
    });
    const q=final.current.reading.q_identity_transit;
    assert.deepEqual(orientationUniforms.host_orientation,[q.x,q.y,q.z,q.w],'Actual host input must retain the admitted native orientation');
    assert.equal(orientationUniforms.count,9);assert.ok(orientationUniforms.transport>0&&orientationUniforms.driveScale>0);assert.equal(orientationUniforms.dominance,DOMINANCE);
    if(orientationConsumer==='identity-disconnected')assert.equal(orientationUniforms.orientation,null,'The negative consumer must truly exclude the orientation input from the GPU program');
    else assert.deepEqual(orientationUniforms.orientation,[q.x,q.y,q.z,q.w].map(Math.fround),'Actual linked GPU uniform must receive the native quaternion');
    artifact(name+'-actual-linked-gpu-uniforms.json',orientationUniforms);
   }
   assert.deepEqual(material(final),material(initial));assert.deepEqual(final.state.camera,initial.state.camera);
   assert.equal(final.rendered.steps-initial.rendered.steps,STEPS,'A hidden extra integration invalidates the fixed-step comparison');
   assert.ok(Math.abs(final.rendered.simTime-STEPS*DT)<=STEPS*Number.EPSILON*4,'Actual resident clock differs from fixed steps');
   for(const entity of required(final))assert.deepEqual(samples(final,entity,'targets'),samples(initial,entity,'targets'),'Actual source targets must stay fixed');
   if(waves)validateDrivers(final,excitation,excitation>0);else assert.equal(driverRows(final).length,0);
   if(waves&&excitation>0){
    // Real positive modal history makes a teardown/re-admission observable.
    // Depth visibility is the sole intervention; no reset, step or native pin.
    ui=await composition();assert.equal(await ui.force.inputValue(),'direct-planetary-resonance');assert.ok(await ui.waves.isChecked());await closeNara();
    ui=await composition();await closeNara();const depth=await read();
    assert.deepEqual(depth.rendered.localizedResonance,final.rendered.localizedResonance,'Opening/closing depth destroyed actual resident modal history');
    assert.equal(depth.rendered.steps,final.rendered.steps);assert.equal(depth.rendered.simTime,final.rendered.simTime);
    for(const key of fields)assert.deepEqual(depth.rendered[key],final.rendered[key],'Depth visibility changed actual GPU '+key);
    artifact(name+'-positive-depth-preserved.json',depth);
   }
   const pixels=await frame.evaluate(()=>{const canvas=window.__FIELD_STUDIES__.capture(360,250);return Array.from(canvas.getContext('2d').getImageData(0,0,360,250).data);});
   artifact(name+'-after.json',final);artifact(name+'-rgba.json',{width:360,height:250,rgba:pixels});await shot('after');
   const nativeOwner=await readOwner(world.working.native_ref);artifact(name+'-actual-native-owner.json',nativeOwner);
   const exact=nativeOwner.scenes.find(s=>s.scene_ref===sceneRef);
   assert.ok(exact?.presentation?.scene,'Actual native owner lost the personal body material');
   for(const [index,entity] of final.record.receiving.personal.centre_entity_refs.entries())assert.equal(nativeOwner.entities[entity].subject.subject_ref,`ql:m-coordinate:bimba:M2-5-0/1-${index+1}`);
   assert.equal(nativeOwner.entities[final.record.receiving.personal.locus_entity_ref].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
   if(excitationChanged){await tune(EXCITATION);excitationChanged=false;const restored=await read();assert.deepEqual(material(restored),material(opening));assert.equal(actualScene(restored).field.params.excitation,EXCITATION);artifact(name+'-restored-positive-input.json',restored);}
   // The live UI edit is a presentation intervention. Report its actual
   // native material receiving standing; do not pretend an uncommitted live
   // numeric control was acknowledged by CAS or saved to the original file.
   const nativeMaterialExcitation=exact.presentation.scene.field?.params?.excitation;
   const result={name,waves,excitation,orientationConsumer,orientationUniforms,opening,initial,final,pixels};results.push(result);
   receipt.trials.push({name,waves,excitation,orientation_consumer:orientationConsumer,native_material_excitation:nativeMaterialExcitation,live_edit_native_material_acknowledged:nativeMaterialExcitation===excitation,saved_file_rewrite_claim:false,person_ref:final.record.person_ref,expression_ref:final.working.native_ref,file:final.working.file,identity:final.record.identity_source,event_ref:final.record.world.event_ref,source_revision:final.record.source_basis.source_revision,driver_count:driverRows(final).length,steps:final.rendered.steps,gpu_positions_sha256:sha(JSON.stringify(final.rendered.positions)),gpu_velocities_sha256:sha(JSON.stringify(final.rendered.velocities)),rgba_sha256:sha(JSON.stringify(pixels))});
   passed(name+': actual file/UI, unchanged protected basis, exact fixed-step GPU readback and owner source subjects');return result;
  }catch(error){artifact(name+'-failure.json',{error:String(error.stack??error)});if(frame)try{artifact(name+'-failure-state.json',await read());await shot('failure');}catch(capture){receipt.capture_error=String(capture);}throw error;
  }finally{
   // Restore only this helper's explicit live numeric intervention. Never
   // retry a refused owner operation or mutate protected identity/occasion.
   if(excitationChanged&&frame)try{await tune(EXCITATION);receipt.cleanup_restored_excitation=true;}catch(error){receipt.cleanup_error=String(error);save();}
   await context.close();
  }
 }
 try{
  const positive=await trial(worldA,'a-positive',EXCITATION,true);
  const zero=await trial(worldA,'a-live-zero',0,true);
  const disconnected=await trial(worldA,'a-disconnected',EXCITATION,false);
  const repeat=await trial(worldA,'a-repeat-positive',EXCITATION,true);
  for(const r of [zero,disconnected,repeat]){
   assert.deepEqual(lock(r.initial),lock(positive.initial),'Trials have different native source/person/occasion bases');
   assert.deepEqual(material(r.initial),material(positive.initial),'Unrelated authored inputs changed');
   assert.deepEqual(r.initial.state.camera,positive.initial.state.camera);
   assert.equal(r.initial.rendered.particleCount,positive.initial.rendered.particleCount);
   assert.deepEqual(r.initial.rendered.partitions,positive.initial.rendered.partitions);
   for(const key of fields)assert.deepEqual(r.initial.rendered[key],positive.initial.rendered[key],'Fresh seeded trials must start from exactly identical GPU '+key);
   const a=jsonCopy(r.initial.telemetry.config),b=jsonCopy(positive.initial.telemetry.config);delete a.cymatics.driveStrength;delete b.cymatics.driveStrength;assert.deepEqual(a,b,'Unrelated actual engine inputs changed');
  }
  assert.deepEqual(invariantDrivers(zero.initial),invariantDrivers(positive.initial),'Live-zero changed driver IDs/frequencies/origins/material rather than excitation');
  assert.deepEqual(invariantDrivers(zero.final),invariantDrivers(positive.final));
  const effects=required(positive.final).map(entity=>{
   const row={entity_ref:entity,count:partition(positive.final,entity).end-partition(positive.final,entity).start};
   for(const key of ['positions','velocities']){const effect=difference(samples(positive.final,entity,key),samples(zero.final,entity,key)),noise=difference(samples(positive.final,entity,key),samples(repeat.final,entity,key));
    const floor=8*Math.max(noise.max,effect.float32_ulp_max,noise.float32_ulp_max);
    row[key]={effect,repeat_noise:noise,required_floor:floor};
    assert.ok(effect.changed>0&&effect.max>floor,entity+' has no resolved modal '+key+' effect above its independently measured repeat/Float32 floor');}
   return row;
  });
  const pixels=pixelDifference(positive.pixels,zero.pixels),noise=pixelDifference(positive.pixels,repeat.pixels);
  assert.ok(pixels.changed>0&&pixels.absolute>8*noise.absolute,'Modal pixel effect is absent or smaller than repeat noise');
  artifact('same-nine-modal-effect.json',{effects,pixels,repeat_pixel_noise:noise,
   disconnected_pixel_difference:pixelDifference(positive.pixels,disconnected.pixels),
   distinction:'Projection removal changes localCount and formation spring mixture; only positive versus live-zero with nine retained drivers isolates modal excitation.'});
  passed('All seven actual centre bodies have modal position/velocity effects beyond measured repeat and Float32 precision; pixels differ with the same nine drivers and spring mixture');
  const negated=await trial(worldA,'a-orientation-sign-equivalent',EXCITATION,true,'negated');
  const cut=await trial(worldA,'a-orientation-consumer-cut',EXCITATION,true,'identity-disconnected');
  for(const r of [negated,cut]){
   assert.deepEqual(lock(r.initial),lock(positive.initial));assert.deepEqual(material(r.initial),material(positive.initial));
   assert.deepEqual(r.initial.telemetry.config,positive.initial.telemetry.config);assert.deepEqual(r.initial.state.camera,positive.initial.state.camera);
   assert.deepEqual(r.initial.rendered.partitions,positive.initial.rendered.partitions);
   for(const key of fields)assert.deepEqual(r.initial.rendered[key],positive.initial.rendered[key],'Orientation-only trial changed initial GPU '+key);
   assert.deepEqual(driverRows(r.initial),driverRows(positive.initial),'Orientation-only trial changed the initial nine drivers');
   assert.deepEqual(driverRows(r.final),driverRows(positive.final),'Orientation-only trial changed modal weights, origins, frequencies, parameters or envelopes');
  }
  const orientationEffects=required(positive.final).map(entity=>{
   const row={entity_ref:entity};
   for(const key of ['positions','velocities']){
    const effect=difference(samples(positive.final,entity,key),samples(cut.final,entity,key)),noise=difference(samples(positive.final,entity,key),samples(repeat.final,entity,key)),equivalent=difference(samples(positive.final,entity,key),samples(negated.final,entity,key));
    const floor=8*Math.max(noise.max,effect.float32_ulp_max,equivalent.float32_ulp_max);
    assert.ok(equivalent.max<=8*Math.max(noise.max,equivalent.float32_ulp_max),'Sign-equivalent quaternion changed actual '+key+' beyond repeat/Float32 precision');
    assert.ok(effect.changed>0&&effect.max>floor,'Native orientation has no resolved '+key+' effect in '+entity);
    row[key]={effect,sign_equivalent:equivalent,repeat_noise:noise,required_floor:floor};
   }return row;
  });
  const actualQ=positive.orientationUniforms.orientation,q={x:actualQ[0],y:actualQ[1],z:actualQ[2],w:actualQ[3]},minus=Object.fromEntries(Object.entries(q).map(([key,v])=>[key,-v]));
  const predictions=required(positive.final).map(entity=>{
   const p=partition(positive.final,entity),rows=[];
   for(let index=p.start;index<p.end;index+=Math.max(1,Math.floor((p.end-p.start)/16))){
    const position=positive.final.rendered.positions.slice(index*4,index*4+3),normal=predictLocalIntensityForce(position,driverRows(positive.final),q,positive.orientationUniforms),sign=predictLocalIntensityForce(position,driverRows(positive.final),minus,positive.orientationUniforms),identity=predictLocalIntensityForce(position,driverRows(positive.final),{w:1,x:0,y:0,z:0},positive.orientationUniforms);
    assert.deepEqual(sign,normal,'Independent Hamilton rotation prediction violates q/-q invariance');
    rows.push({particle:index,position,native_force:normal,sign_equivalent_force:sign,disconnected_identity_force:identity,difference:Math.hypot(...normal.map((v,i)=>v-identity[i]))});
   }
   assert.ok(rows.some(row=>row.difference>1e-8),'Actual centre has no independently predicted orientation-sensitive spatial force');return{entity_ref:entity,rows};
  });
  const orientationPixels=pixelDifference(positive.pixels,cut.pixels),equivalentPixels=pixelDifference(positive.pixels,negated.pixels);
  assert.ok(orientationPixels.changed>0&&orientationPixels.absolute>8*noise.absolute,'Orientation pixel effect does not exceed repeat noise');
  artifact('fixed-nine-driver-orientation-effect.json',{effects:orientationEffects,pixels:orientationPixels,sign_equivalent_pixels:equivalentPixels,predictions,distinction:'Only the real compiled spatial orientation consumer changes. Native current, nine driver weights/frequencies/modal envelopes, authored material, mixture and initial GPU state remain exact.'});
  passed('Native orientation reaches the actual linked GPU program and alters all seven resident bodies with nine identical drivers; q/-q preserves the effect and a real consumer cut defeats it');
  if(worldB){
   const second=await trial(worldB,'b-positive',EXCITATION,true);
   assert.equal(second.final.record.world.event_ref,positive.final.record.world.event_ref);assert.deepEqual(second.final.record.world.sky,positive.final.record.world.sky);
   assert.notEqual(second.final.record.person_ref,positive.final.record.person_ref);assert.notEqual(second.final.record.world.instance_ref,positive.final.record.world.instance_ref);
   assert.notDeepEqual(second.final.current.reading.q_identity_transit,positive.final.current.reading.q_identity_transit);
   const firstPhysics=jsonCopy(positive.initial.telemetry.config),secondPhysics=jsonCopy(second.initial.telemetry.config);
   // Entity forces/shares are the intended person-dependent reception. Every
   // shared constitutive field, renderer budget and presentation input stays fixed.
   delete firstPhysics.entities;delete secondPhysics.entities;
   assert.deepEqual(secondPhysics,firstPhysics,'Two-person trial changed shared renderer physics');
   const a=required(positive.final),b=required(second.final),rows=[];
   for(let i=0;i<7;i++){for(const key of fields)assert.deepEqual(samples(second.initial,b[i],key),samples(positive.initial,a[i],key),'Two-person causal comparison requires naturally identical actual centre geometry/reset');
    const row={centre:i+1,positions:difference(samples(positive.final,a[i],'positions'),samples(second.final,b[i],'positions')),velocities:difference(samples(positive.final,a[i],'velocities'),samples(second.final,b[i],'velocities'))};rows.push(row);}
   assert.ok(rows.some((r,i)=>r.positions.changed&&r.velocities.changed&&r.positions.max>Math.max(effects[i].positions.required_floor,8*r.positions.float32_ulp_max)&&r.velocities.max>Math.max(effects[i].velocities.required_floor,8*r.velocities.float32_ulp_max)),'Distinct native persons have no resolved actual body effect above repeat/Float32 precision');
   const personPixels=pixelDifference(second.pixels,positive.pixels);
   assert.ok(personPixels.changed>0&&personPixels.absolute>8*noise.absolute,'Two-person pixel effect does not exceed repeated-positive noise');
   artifact('two-person-actual-modal-reception.json',{rows,pixels:personPixels,same_event:positive.final.record.world.event_ref,persons:[positive.final.record.person_ref,second.final.record.person_ref]});
   passed('Two controlled persons at one exact occasion retain the canonical hub and independently alter actual resident centres at matched real geometry');
  }else receipt.remaining=['Two-person matched-geometry causal trial is not supplied; input admission is not promoted to this proof.'];
  assert.equal(receipt.cleanup_error,undefined,'Presentation restoration failed');receipt.passed=true;receipt.standing='Executed complete assertions in the recorded browser/native environment';save();return receipt;
 }catch(error){receipt.failure=String(error.stack??error);save();throw error;}
}

/** Proposed insertion in the ordinary native whole replay. Uses the supplied
 * actual production page/frame, acknowledged saved world, and existing replay
 * snapshot/navigation functions. No invented owner data or test-only selection.
 * Run after Person B personal reception (or in an isolated ordinary context),
 * before declaring receipt.passed. Explicit file reopening acknowledges a new
 * native admission; a pending unsaved UI draft remains pending throughout.
 */
export async function runSavedPersonalReleaseGate({page,frame,snapshot,sceneNavigate,world,onPhase=()=>{}}){
 assert.ok(world?.working?.file?.revision&&world.record,'Use an actual acknowledged saved world');
 const personal=world.working.native_ref+':scene:personal',branches=world.working.native_ref+':scene:branches';
 const open=async()=>{await frame.locator('[data-epi="identity"]').click();};
 const close=async()=>{await frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();};
 const observe=()=>page.evaluate(()=>window.__EPI_RELEASE_GATE_OBSERVATIONS__.slice());
 await page.evaluate(()=>{
  const rows=[];window.__EPI_RELEASE_GATE_OBSERVATIONS__=rows;
  window.__EPI_RELEASE_GATE_LISTENER__=event=>{
   if(event.source!==document.querySelector('#world')?.contentWindow||event.data?.v!==1||event.data?.kind!=='nara-instrument')return;
   rows.push({operation:event.data.request?.operation,identity_operation:event.data.request?.request?.operation,request:event.data.req});
  };
  window.addEventListener('message',window.__EPI_RELEASE_GATE_LISTENER__);
 });
 try{
  onPhase('actual saved-person release fence');
  await sceneNavigate(personal);await frame.evaluate(()=>window.__FIELD_STUDIES__.pause());
  const before=await snapshot('release-gate-before',true);
  assert.equal(before.working.native_ref,world.working.native_ref);
  assert.equal(before.rendered.localizedResonance.length,9,'Begin with the actual admitted body');
  const source=JSON.stringify([before.record.person_ref,before.record.identity_source,before.record.identity_input_revision,before.record.world.event_ref,before.record.world.snapshot_ref]);
  await open();await frame.getByRole('button',{name:'Composition',exact:true}).click();
  const force=frame.getByRole('combobox',{name:'Natal force presentation'});
  assert.equal(await force.isEnabled(),true);assert.equal(await force.inputValue(),'direct-planetary-resonance');
  assert.equal(await frame.getByRole('checkbox',{name:'Enter the current standing-wave field'}).isChecked(),true);
  const depthStart=(await observe()).length;await close();await open();await close();
  const same=await snapshot('release-gate-depth-preserved',true);
  assert.deepEqual(same.rendered.localizedResonance,before.rendered.localizedResonance,'Opening/closing depth must preserve actual driver IDs and resident amplitudes');
  assert.equal(same.rendered.steps,before.rendered.steps);assert.equal(same.rendered.simTime,before.rendered.simTime);
  assert.deepEqual((await observe()).slice(depthStart).filter(r=>['select_identity','current_pin'].includes(r.operation)),[],'Depth visibility must not select/pin');
  await open();await frame.getByRole('combobox',{name:'Saved profiles'}).selectOption('');
  await frame.waitForFunction(()=>!document.querySelector('.nara-personal-status')?.textContent?.includes('Opening your profile'));
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===0);
  await frame.getByRole('button',{name:'Identity',exact:true}).click();
  const draftName=world.current.reading.identity.profile.name+' pending correction';
  await frame.getByLabel('Your name',{exact:true}).fill(draftName);await close();
  const releasedAt=(await observe()).length;
  await sceneNavigate(branches);await sceneNavigate(personal);
  const released=await snapshot('release-gate-branch-return',true);
  assert.equal(released.rendered.localizedResonance.length,0,'Scene travel must not recreate the released nine-driver receiving body');
  assert.equal(JSON.stringify([released.record.person_ref,released.record.identity_source,released.record.identity_input_revision,released.record.world.event_ref,released.record.world.snapshot_ref]),source);
  assert.deepEqual((await observe()).slice(releasedAt).filter(r=>['select_identity','current_pin'].includes(r.operation)),[],'Scene travel must not implicitly reselect/pin a released person');
  await open();await frame.getByRole('button',{name:'Identity',exact:true}).click();
  assert.equal(await frame.getByLabel('Your name',{exact:true}).inputValue(),draftName,'Actual pending draft survives close/scene travel/reopen');
  await frame.getByRole('button',{name:'Composition',exact:true}).click();assert.equal(await force.isEnabled(),false,'Released pending identity must not expose saved-person controls');await close();
  onPhase('actual explicit saved-file admission after release');
  const admitAt=(await observe()).length;
  assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),world.working.file.location.path),true);
  await frame.waitForFunction(ref=>{const f=window.__FIELD_STUDIES__;return f.epiWorld()?.world.instance_ref===ref&&!f.nativeWorking()?.pending;},world.working.native_ref,{timeout:180000});
  await sceneNavigate(personal);await frame.waitForFunction(()=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===9,null,{timeout:180000});
  const admitted=await snapshot('release-gate-explicit-admission',true);
  const operations=(await observe()).slice(admitAt);
  assert.ok(operations.some(r=>r.operation==='select_identity'),'New native admission must acknowledge actual identity selection');
  assert.ok(operations.some(r=>r.operation==='current_pin'),'New native admission must acknowledge retained-occasion pin');
  assert.equal(admitted.current.context.event_ref,world.record.world.event_ref);
  assert.equal(admitted.current.reading.transit.sky.snapshot_ref,world.record.world.snapshot_ref);
  assert.deepEqual(admitted.record.identity_source,world.record.identity_source);
  assert.equal(admitted.record.receiving.personal.current.ref,admitted.current.context.reading_ref);
  assert.equal(admitted.record.receiving.personal.current.revision,admitted.current.context.reading_revision);
  await open();await frame.getByRole('button',{name:'Identity',exact:true}).click();
  assert.equal(await frame.getByLabel('Your name',{exact:true}).inputValue(),draftName,'Explicit saved world admission must not overwrite the unrelated pending local draft');await close();
  return{passed:true,scope:'Actual ordinary UI release, branch return, depth/draft preservation and explicit saved-file native admission',requests:await observe()};
 }finally{
  await page.evaluate(()=>{window.removeEventListener('message',window.__EPI_RELEASE_GATE_LISTENER__);delete window.__EPI_RELEASE_GATE_LISTENER__;delete window.__EPI_RELEASE_GATE_OBSERVATIONS__;});
 }
}

/** Real cold opening with a controlled transport schedule. One actual native
 * pin reply is fetched unchanged and held before delivery. The owner operation
 * and payload remain real; only response timing is the intervention. This is
 * concurrency evidence, separately labelled from ordinary timing acceptance.
 */
export async function runColdPersonalDraftGate({browser,url,world,output,qualification=null,observePage=()=>{},onPhase=()=>{}}){
 assert.ok(world?.working?.file?.revision&&world.current?.reading?.identity,'Actual acknowledged controlled world required');
 const out=resolve(output);assert.ok(!existsSync(resolve(out,'receipt.json')),'Retain prior evidence');mkdirSync(out,{recursive:true});
 const receipt={schema:'oi.epi-cold-personal-draft-gate/v1',passed:false,qualification,scope:'Ordinary real application/native owner, controlled delivery delay of one unchanged real response; no invented identity/current or installed/hardware claim',checks:[]};
 const artifact=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
 const save=()=>artifact('receipt.json',receipt);save();
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();observePage(page);page.setDefaultTimeout(90000);
 let frame,held=false,release,gateTimer;const delivery=new Promise(r=>{release=r;});let announced;
 const responseReady=new Promise(r=>{announced=r;});
 await page.route('**/op',async route=>{
  const request=route.request().postDataJSON();
  if(held||request?.op!=='nara_current'||request.request?.operation!=='pin'){await route.continue();return;}
  held=true;
  try{
   const response=await route.fetch(),raw=await response.body(),body=JSON.parse(raw.toString());
   assert.equal(body.ok,true);assert.equal(body.outcome?.result,'nara_current');
   receipt.transport={request,response_sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length,status:response.status(),intervention:'Delay only; original response/status/headers/body delivered unchanged'};
   artifact('actual-held-native-current.json',{request,response:body});save();announced({ok:true});
   await delivery;await route.fulfill({response,body:raw});
  }catch(error){receipt.transport_error=String(error.stack??error);save();announced({ok:false,error:String(error)});await route.abort();}
 });
 const read=()=>frame.evaluate(()=>{const f=window.__FIELD_STUDIES__;return{state:f.getState(),working:f.nativeWorking(),record:f.epiWorld(),current:f.epiCurrent(),native:f.native(),rendered:f.inspect(true),document:f.getDocument()};});
 try{
  onPhase('cold personal admission with actual native response held');
  const target=new URL(url);target.searchParams.delete('expression');await page.goto(target.toString());
  await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});
  frame=await page.locator('#world').elementHandle().then(e=>e.contentFrame());
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.openNativeFile,null,{timeout:90000});
  const environment=await frame.evaluate(()=>{const g=document.getElementById('field-canvas').getContext('webgl2'),d=g?.getExtension('WEBGL_debug_renderer_info');return{bundle:document.getElementById('app-bundle')?.textContent,gpu:g?{version:g.getParameter(g.VERSION),renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}:null};});
  assert.ok(environment.bundle&&environment.gpu,'Actual ordinary module and WebGL2 receiver required');receipt.loaded_application_sha256=createHash('sha256').update(environment.bundle).digest('hex');receipt.gpu=environment.gpu;receipt.browser=browser.version();save();
  await page.evaluate(()=>{window.__EPI_COLD_DRAFT_REQUESTS__=[];window.addEventListener('message',event=>{if(event.source===document.querySelector('#world')?.contentWindow&&event.data?.kind==='nara-instrument')window.__EPI_COLD_DRAFT_REQUESTS__.push({operation:event.data.request?.operation,identity_operation:event.data.request?.request?.operation,req:event.data.req});});});
  assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),world.working.file.location.path),true);
  const gate=await Promise.race([responseReady,new Promise(r=>{gateTimer=setTimeout(()=>r({ok:false,error:'Actual native pin response did not reach the controlled hold'}),180000);})]);clearTimeout(gateTimer);assert.equal(gate.ok,true,gate.error);
  await frame.locator('[data-epi="identity"]').click();await frame.getByRole('button',{name:'Identity',exact:true}).click();
  const draftName=world.current.reading.identity.profile.name+' pending cold correction';
  await frame.getByLabel('Your name',{exact:true}).fill(draftName);
  const at=await page.evaluate(()=>window.__EPI_COLD_DRAFT_REQUESTS__.length);
  artifact('pending-draft-before-native-delivery.json',await read());await page.screenshot({path:resolve(out,'pending-draft-before-delivery.png')});
  release();
  await frame.waitForFunction(()=>document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('pending identity edit was retained'),null,{timeout:180000});
  assert.equal(await frame.getByLabel('Your name',{exact:true}).inputValue(),draftName);
  await frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();
  for(const ref of [world.working.native_ref+':scene:branches',world.working.native_ref+':scene:personal']){
   await frame.locator(`[data-epi-scene="${ref}"]`).click();await frame.waitForFunction(r=>{const f=window.__FIELD_STUDIES__;return f.getDocument().scenes[f.getState().sceneIndex].id===r;},ref);
  }
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===0);
  const after=await read();artifact('cancelled-admission-after-branch-return.json',after);await page.screenshot({path:resolve(out,'cancelled-after-return.png')});
  assert.equal(after.record.world.instance_ref,world.working.native_ref);assert.equal(after.record.person_ref,world.record.person_ref);
  assert.equal(after.rendered.localizedResonance.length,0,'Cancelled cold admission must not resurrect old nine-driver body');
  const requests=await page.evaluate(()=>window.__EPI_COLD_DRAFT_REQUESTS__.slice());artifact('actual-nara-channel-requests.json',requests);
  assert.deepEqual(requests.slice(at).filter(r=>['select_identity','current_pin'].includes(r.operation)),[],'Cancellation must prevent subsequent implicit identity selection or pin');
  await frame.locator('[data-epi="identity"]').click();await frame.getByRole('button',{name:'Identity',exact:true}).click();
  assert.equal(await frame.getByLabel('Your name',{exact:true}).inputValue(),draftName,'Pending real user draft must survive cancelled native result and scene travel');
  receipt.checks=['Actual native response fetched and delivered unchanged','Real pending identity edit cancels in-flight host admission','No subsequent select/pin after explicit edit','No personal driver resurrection after branch return','Actual unsaved draft retained'];receipt.passed=true;
 }catch(error){receipt.failure=String(error.stack??error);if(frame)try{artifact('failure-state.json',await read());await page.screenshot({path:resolve(out,'failure.png')});}catch(capture){receipt.capture_error=String(capture);}throw error;
 }finally{clearTimeout(gateTimer);release();save();await context.close();}
 return receipt;
}
