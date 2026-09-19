import {PointCloudField} from '../../src/engine/PointCloudField';
import {GlyphSampler} from '../../src/engine/GlyphSampler';
import {sourceStudies} from '../src/sourceExamples';
import {clone,uid} from '../src/model';
import {toNativeConfig} from '../src/nativeBridge';
import {readDraft,writeDraft,removeDraft} from '../src/recovery';
const results=document.getElementById('results')!,status=document.getElementById('status')!;
let passed=0,failed=0,field:PointCloudField|undefined;
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
async function test(name:string,fn:()=>unknown|Promise<unknown>){const row=document.createElement('li');try{await fn();row.textContent='PASS · '+name;row.className='pass';passed++;}catch(e){row.textContent='FAIL · '+name+' · '+String(e);row.className='fail';failed++;}results.append(row);}
const rms=(a:number[],b:number[])=>Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/a.length);
async function decode(url:string){const img=new Image();img.src=url;await img.decode();return img;}
const study=clone(sourceStudies().find(s=>s.id==='source-twelve-faces')!.expression),s=study.scenes[0],e=s.entities[0];
s.field.params.count=4096;s.engine.autoOscillate=false;s.engine.morphEnabled=true;e.sequence.manual=true;e.sequence.enabled=false;
e.sequence.steps.push({...clone(study.scenes[1].entities[0].sequence.steps[0]),id:'second-mask'});
const cfg=toNativeConfig(s);cfg.automations=[{id:'recovery-lfo',path:'fluid.viscosity',enabled:true,type:'lfo',waveform:'sine',rateHz:.2,min:.7,max:.96}];
const canvas=document.getElementById('field') as HTMLCanvasElement;
try{
 field=new PointCloudField(canvas,cfg,true);
 const engine=field;
 await test('two image states produce distinct native GPU targets; reordering preserves source identity',async()=>{
  for(const k of e.sequence.steps){assert(k.source?.kind==='image','Image source missing from state');engine.loadCustomImage(await decode(k.source.image.dataUrl!),k.source.image,e.id,k.id);}
  engine.setMorphProgress(0);engine.advance(0);engine.seedCurrentTargets();const a=engine.inspectState(true).positions;
  engine.setMorphProgress(1);engine.advance(0);engine.seedCurrentTargets();const b=engine.inspectState(true).positions;
  assert(a.every(Number.isFinite)&&b.every(Number.isFinite),'Non-finite GPU target');assert(rms(a,b)>5,'Two distinct masks collapsed to the same targets');
  const swapped=clone(cfg);swapped.entities![0].sequence.links.reverse();swapped.morphProgress=0;engine.replaceConfig(swapped);engine.advance(0);engine.seedCurrentTargets();const swappedA=engine.inspectState(true).positions;
  assert(rms(swappedA,b)<rms(swappedA,a),'Reorder detached the source from its state ID');
 });
 await test('large ASCII mask fits the complete raster and retains dense candidate coverage',()=>{
  const ascii=sourceStudies().find(s=>s.id==='source-mask-ascii')!.expression.scenes[0].entities[0].source;assert(ascii?.kind==='ascii','Missing ASCII study');const sampled=new GlyphSampler().rasterizeAscii(ascii.ascii.text,ascii.ascii);
  assert(!sampled.analysis.fallback,'ASCII fell back');assert(sampled.analysis.contentPx.h<1000&&sampled.analysis.contentPx.h>700,'ASCII clipped or shrank out of its frame');assert(sampled.candidates.length>2000&&sampled.candidates.every(p=>[p.x,p.y,p.density].every(Number.isFinite)),'ASCII lost its drawing detail');
 });
 await test('an empty ASCII edit keeps real GPU targets finite',()=>{
  engine.loadAsciiArt('   \n  ',{fontSize:32},e.id,e.sequence.steps[1].id);engine.setMorphProgress(0);engine.advance(0);engine.seedCurrentTargets();assert(engine.inspectState(true).positions.every(Number.isFinite),'Empty source produced invalid GPU positions');
 });
 await test('driver clocks and LFO output recover identically in a new real engine',()=>{
  for(let i=0;i<20;i++)engine.advance(.05);engine.advance(0);const clock=engine.getTransportState(),value=engine.getEvaluation().live[0]?.value;assert(clock.lanes.length===1,'LFO runtime not captured');
  const secondCanvas=document.createElement('canvas');secondCanvas.width=640;secondCanvas.height=480;const restored=new PointCloudField(secondCanvas,cfg,true);try{restored.restoreTransportState(JSON.parse(JSON.stringify(clock)));restored.advance(0);assert(Math.abs(restored.inspectState().simTime-clock.simTime)<1e-10,'Clock restarted');assert(Math.abs(restored.getEvaluation().live[0].value-value!)<1e-9,'Automation phase restarted');}finally{restored.destroy();}
 });
 await test('an image-heavy expression round-trips through real IndexedDB draft recovery',async()=>{
  const draft=clone(study);draft.id=uid('workflow-regression');try{await writeDraft(draft);const read=await readDraft(draft.id);assert(JSON.stringify(read)===JSON.stringify(draft),'Stored draft changed sources or working state');}finally{await removeDraft(draft.id);}
 });
}catch(e){await test('native engine starts',()=>{throw e;});}
finally{field?.destroy();status.textContent=`${passed} passed · ${failed} failed`;status.dataset.result=failed?'failed':'passed';}
