/** Timeline views and card style — lane-2 T15 (a named view: camera, projection and relation mode, filters, walk chain, open
 * frame, working set), T16 (a card's colours persist through the Scene's timeline layout record) and T18 (the frame and the
 * working set are refs, re-read through the native owner on restore). Pure proof through the esbuild-in-tmp pattern of
 * places-views.test.mjs, plus source reads of the chronology wiring, the lens hook and the kernel's validator.
 *
 * Covers: capture then restore is exact (camera, projection, relation links, category, relation-type and tag filters, walk
 * chain, frame, stack order); an absent frame restores the Earth zero-case; the name, stack and view-count bounds; the card
 * colour grammar and its refusal reasons; save and remove touch only timelineViews; a refused write leaves the Scene as it
 * was; the kernel holds the same lists and bounds (read from its Rust source); the refusal string is gone and the
 * capability is honest.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const timelineDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/timeline');
const kernelSource=resolve(engine,'../../kernel/src/expression_scene.rs');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-timeline-views-'));
 try{
  const out=join(temporary,'timeline-views.mjs');
  const entries={
   timeline:resolve(engine,'src/timelineViews.ts'),
   material:resolve(engine,'src/researchMaterial.ts'),
   labels:resolve(engine,'src/undoLabels.ts'),
   categories:resolve(timelineDir,'categories.ts'),
  };
  const contents=Object.entries(entries).map(([name,file])=>`export * as ${name} from ${JSON.stringify(file)};`).join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const read=(file)=>readFileSync(file,'utf8');
/** Source with comments removed, so a rule about code is not tripped by the prose that explains it. */
const code=(text)=>text.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(line=>line.replace(/\/\/.*$/,'')).join('\n');
const roundTrip=(value)=>JSON.parse(JSON.stringify(value));
const ids=new Set(['e1']);
const presentation={
 camera:{centerYear:1850.5,pixelsPerYear:4},
 hiddenCategories:['claim','myth'],
 relationTypes:['caused by','born in'],
 tags:['war'],
 relationLinks:false,
 chainId:'hop-1',
 frameNodeId:'node-a',
 workingSetRefs:['node-c','node-a','node-b'],
};
const view=()=>api.timeline.timelineViewOf({projection:'chronology',presentation});
const scene=()=>({id:'scene-1',name:'Scene',entities:[{id:'e1',name:'Object'}],research:{...api.material.emptyResearchMaterial(),
 namedViews:{'canvas view':{viewport:{x:1,y:2,zoom:3},selectedRefs:[],frameOrder:[]}},
 placeViews:{Paris:{viewport:{x:0,y:0,zoom:1},window:null}},
 frames:{f1:{label:'Frame',memberRefs:['e1'],z:0}},
 timeline:{'node-a':{offsetY:12,width:240,height:160,lane:'default',layoutRevision:1}}}});

test('a view restores its camera, projection, relation links, filters, walk chain, frame and stack exactly', ()=>{
 const saved=roundTrip(view());
 assert.deepEqual(saved.camera,{centerYear:1850.5,pixelsPerYear:4});
 assert.deepEqual(saved.filters,{hiddenCategories:['claim','myth'],relationTypes:['caused by','born in'],tags:['war']});
 assert.deepEqual(saved.workingSetRefs,['node-c','node-a','node-b'],'the stack keeps the order the person stacked it');
 assert.doesNotThrow(()=>api.material.validateTimelineView(saved));
 const plan=api.timeline.timelineViewRestorePlan(saved);
 assert.equal(plan.projection,'chronology');
 assert.deepEqual(plan.presentation,presentation);
});

test('a relation-field view and an open chronology carry no frame, and restore the Earth zero-case', ()=>{
 const open=roundTrip(api.timeline.timelineViewOf({projection:'relations',presentation:{...presentation,
  frameNodeId:null,chainId:null,relationTypes:null,tags:[],hiddenCategories:[],workingSetRefs:[]}}));
 assert.equal('frameNodeId' in open,false,'an absent frame is absent from the record');
 assert.equal(open.filters.relationTypes,null,'null relation types mean every type');
 assert.doesNotThrow(()=>api.material.validateTimelineView(open));
 const plan=api.timeline.timelineViewRestorePlan(open);
 assert.equal(plan.projection,'relations');
 assert.equal(plan.presentation.frameNodeId,null);
 assert.equal(plan.presentation.relationTypes,null);
 assert.deepEqual(plan.presentation.workingSetRefs,[]);
});

test('a repeated node is kept once, an unknown category is dropped, and a camera past its bounds is clamped', ()=>{
 const many=Array.from({length:64},(_,i)=>`n${i}`);
 assert.deepEqual(api.timeline.timelineViewOf({projection:'chronology',presentation:{...presentation,workingSetRefs:[...many,'n0']}}).workingSetRefs,many);
 assert.throws(()=>api.timeline.timelineViewOf({projection:'chronology',presentation:{...presentation,workingSetRefs:[...many,'n64']}}),/at most 64 working-set nodes/,'a 65th node is refused, never truncated');
 assert.deepEqual(api.timeline.timelineViewOf({projection:'chronology',presentation:{...presentation,hiddenCategories:['not-a-category','claim']}}).filters.hiddenCategories,['claim']);
 const clamped=api.timeline.timelineViewOf({projection:'chronology',presentation:{...presentation,camera:{centerYear:1e12,pixelsPerYear:1e20}}});
 assert.deepEqual(clamped.camera,{centerYear:1e10,pixelsPerYear:1e14});
 assert.throws(()=>api.timeline.timelineViewOf({projection:'chronology',presentation:{...presentation,camera:{centerYear:Number.NaN,pixelsPerYear:4}}}),/not readable/);
 assert.throws(()=>api.material.validateTimelineView({...roundTrip(view()),workingSetRefs:['x'.repeat(513)]}),undefined,'a ref past 512 units is refused');
});

test('a view name is 1 to 160 UTF-16 units and at most 32 views are kept; a name already kept may be saved again', ()=>{
 assert.match(api.timeline.timelineViewNameProblem('   ',{}),/Name the timeline view first/);
 assert.match(api.timeline.timelineViewNameProblem('x'.repeat(161),{}),/at most 160 characters/);
 assert.equal(api.timeline.timelineViewNameProblem('x'.repeat(160),{}),null);
 assert.match(api.timeline.timelineViewNameProblem('\u{1F600}'.repeat(81),{}),/at most 160/,'81 emoji are 162 units');
 const full=Object.fromEntries(Array.from({length:32},(_,i)=>[`v${i}`,{}]));
 assert.match(api.timeline.timelineViewNameProblem('new',full),/at most 32 views/);
 assert.equal(api.timeline.timelineViewNameProblem('v3',full),null);
});

test('the material admits the closed view and refuses what its bounds exclude', ()=>{
 const base=api.material.emptyResearchMaterial();
 const named=(name,value)=>({...base,timelineViews:{[name]:value}});
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(named('Paris',roundTrip(view())),ids));
 assert.doesNotThrow(()=>api.material.validateResearchMaterial(named('\u{1F600}'.repeat(80),roundTrip(view())),ids));
 assert.throws(()=>api.material.validateResearchMaterial(named('\u{1F600}'.repeat(81),roundTrip(view())),ids));
 const good=roundTrip(view());
 const refused=[
  {...good,extra:1},
  {...good,camera:{...good.camera,roll:1}},
  {...good,camera:{centerYear:2e10,pixelsPerYear:4}},
  {...good,camera:{centerYear:0,pixelsPerYear:1e15}},
  {...good,projection:'field'},
  {...good,relationLinks:'yes'},
  {...good,filters:{...good.filters,source:true}},
  {...good,filters:{...good.filters,hiddenCategories:['not-a-category']}},
  {...good,filters:{...good.filters,relationTypes:'born in'}},
  {...good,filters:{...good.filters,tags:['x'.repeat(161)]}},
  {...good,chainId:''},
  {...good,frameNodeId:''},
  {...good,workingSetRefs:['a','a']},
  {...good,workingSetRefs:Array.from({length:65},(_,i)=>`n${i}`)},
 ];
 for(const value of refused)assert.throws(()=>api.material.validateResearchMaterial(named('v',value),ids),undefined,JSON.stringify(value).slice(0,140));
 const {camera,...noCamera}=good;
 assert.throws(()=>api.material.validateResearchMaterial(named('v',noCamera),ids),undefined,'a view without its camera');
 const many=Object.fromEntries(Array.from({length:33},(_,i)=>[`v${i}`,good]));
 assert.throws(()=>api.material.validateResearchMaterial({...base,timelineViews:many},ids),undefined,'33 views');
});

test('saving or removing a timeline view touches only timelineViews, and a refused save leaves the Scene as it was', ()=>{
 const s=scene();
 const before=roundTrip(s);
 api.material.applyResearchMaterial(s,{type:'timeline-view-save',name:'War',view:view()});
 assert.deepEqual(Object.keys(s.research.timelineViews),['War']);
 assert.deepEqual(s.research.placeViews,before.research.placeViews,'place views are untouched');
 assert.deepEqual(s.research.namedViews,before.research.namedViews,'canvas views are untouched');
 assert.deepEqual(s.research.timeline,before.research.timeline,'timeline layouts are untouched');
 assert.deepEqual(s.entities,before.entities);
 const saved=JSON.stringify(s);
 assert.throws(()=>api.material.applyResearchMaterial(s,{type:'timeline-view-save',name:'   ',view:view()}),/Invalid timeline view name/);
 assert.throws(()=>api.material.applyResearchMaterial(s,{type:'timeline-view-save',name:'bad',view:{...view(),extra:1}}));
 assert.equal(JSON.stringify(s),saved,'a refused save writes nothing');
 api.material.applyResearchMaterial(s,{type:'timeline-view-remove',name:'War'});
 assert.equal(s.research.timelineViews,undefined,'the last timeline view leaves no empty record');
 assert.deepEqual(s.research,before.research,'removing a timeline view leaves every other record as it was');
});

test('the thirty-third timeline view is refused, and the Scene is left as it was', ()=>{
 const s=scene();
 s.research.timelineViews=Object.fromEntries(Array.from({length:32},(_,i)=>[`v${i}`,roundTrip(view())]));
 const saved=JSON.stringify(s);
 assert.throws(()=>api.material.applyResearchMaterial(s,{type:'timeline-view-save',name:'v32',view:view()}),/Timeline view count exceeds its bound/);
 assert.equal(JSON.stringify(s),saved);
 api.material.applyResearchMaterial(s,{type:'timeline-view-save',name:'v3',view:view()});
 assert.equal(Object.keys(s.research.timelineViews).length,32,'an existing name may be saved again');
});

test('a card colour persists through the timeline layout record, and the grammar refuses anything else with the reason', ()=>{
 const s=scene();
 api.material.applyResearchMaterial(s,{type:'timeline-layout',id:'node-a',expectedRevision:1,value:{offsetY:12,width:240,height:160,lane:'default',style:{dotColour:'#79c0d4',bgColour:'#102633aa'}}});
 assert.deepEqual(s.research.timeline['node-a'].style,{dotColour:'#79c0d4',bgColour:'#102633aa'});
 assert.equal(s.research.timeline['node-a'].layoutRevision,2,'the write advances the layout revision');
 const saved=JSON.stringify(s);
 for(const style of [{dotColour:'red'},{textColour:'#fff'},{borderColour:'#79c0d4'},{dotColour:7}]){
  assert.throws(()=>api.material.applyResearchMaterial(s,{type:'timeline-layout',id:'node-a',expectedRevision:2,value:{offsetY:12,style}}),undefined,JSON.stringify(style));
 }
 assert.equal(JSON.stringify(s),saved,'a refused colour writes nothing');
 // A layout write carries the whole style the card holds: a write without style clears it, as the lens sends its full snapshot.
 api.material.applyResearchMaterial(s,{type:'timeline-layout',id:'node-a',expectedRevision:2,value:{offsetY:12}});
 assert.equal('style' in s.research.timeline['node-a'],false);
 assert.equal(api.timeline.timelineStyleLoaded(undefined).dotColour,undefined);
});

test('the host maps a card style through the grammar: colours kept, unknown keys named, invalid colours explained', ()=>{
 assert.deepEqual(api.timeline.timelineStyleOf({dotColour:'#79c0d4',bgColour:'#102633aa',textColour:undefined}),{dotColour:'#79c0d4',bgColour:'#102633aa'});
 assert.throws(()=>api.timeline.timelineStyleOf({borderColour:'#79c0d4'}),/Timeline style field "borderColour" has no native Scene write mapping/);
 assert.throws(()=>api.timeline.timelineStyleOf({dotColour:'red'}),/Timeline colour is invalid/);
 assert.deepEqual(api.timeline.timelineStyleLoaded({dotColour:'#000000'}),{dotColour:'#000000'});
 assert.deepEqual(api.timeline.timelineStyleLoaded(undefined),{});
});

test('a restore names the nodes it could not re-read, and says nothing extra when all resolved', ()=>{
 assert.equal(api.timeline.timelineRestoreNote('War',[]),'View "War" restored');
 assert.match(api.timeline.timelineRestoreNote('War',['n1']),/1 node is no longer in this reading and was left out/);
 assert.match(api.timeline.timelineRestoreNote('War',['n1','n2']),/2 nodes are no longer in this reading and were left out/);
});

test('undo names the timeline view and the card style it changes', ()=>{
 assert.equal(api.labels.researchMaterialLabel({type:'timeline-view-save'}),'Save timeline view');
 assert.equal(api.labels.researchMaterialLabel({type:'timeline-view-remove'}),'Remove timeline view');
 assert.equal(api.labels.researchMaterialLabel({type:'timeline-layout'}),'Arrange or style timeline card');
});

test('the kernel holds the same lists and bounds the app does, and admits the same record', ()=>{
 const kernel=read(kernelSource);
 const list=(name)=>{
  const match=kernel.match(new RegExp(`const ${name}: &\\[&str\\] = &\\[([\\s\\S]*?)\\];`));
  assert.ok(match,`${name} is declared`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(entry=>entry[1]);
 };
 assert.deepEqual(list('TIMELINE_CATEGORY_IDS'),api.categories.TIMELINE_CATEGORIES.map(category=>category.id));
 const scalar=(name)=>{
  const match=kernel.match(new RegExp(`const ${name}: f64 = ([0-9.e+-]+);`));
  assert.ok(match,`${name} is declared`);
  return Number(match[1]);
 };
 assert.equal(scalar('TIMELINE_CENTER_YEAR_LIMIT'),api.material.TIMELINE_CENTER_YEAR_LIMIT);
 assert.equal(scalar('TIMELINE_PIXELS_PER_YEAR_LOW'),api.material.TIMELINE_PIXELS_PER_YEAR_RANGE[0]);
 assert.equal(scalar('TIMELINE_PIXELS_PER_YEAR_HIGH'),api.material.TIMELINE_PIXELS_PER_YEAR_RANGE[1]);
 assert.match(kernel,/"placeViews",\s*"timelineViews",/,'the top-level keys admit timelineViews');
 assert.match(kernel,/"layoutRevision",\s*"style",?\s*\]/,'a timeline layout admits its style');
 assert.match(kernel,/fn timeline_view\(value: &Value\)/);
 assert.ok(api.material.TIMELINE_VIEW_LIMIT===32&&api.material.TIMELINE_VIEW_REF_LIMIT===64&&api.material.TIMELINE_REF_MAX===512,'the bounds the kernel names');
});

test('the chronology saves, restores and removes named views, and the refusal is gone', ()=>{
 const host=code(read(resolve(engine,'src/researchInstruments.tsx')));
 const data=code(read(resolve(engine,'src/researchInstrumentsData.ts')));
 const lens=code(read(resolve(timelineDir,'TimelineLens.tsx')));
 assert.doesNotMatch(host,/Timeline style has no native material mapping yet/,'the style refusal is replaced by the write');
 assert.match(host,/type:'timeline-view-save'/);
 assert.match(host,/type:'timeline-view-remove'/);
 assert.match(host,/data\.dataSource\.bindPresentation=/,'the mounted lens holds its presentation through the host');
 assert.match(host,/key=\{state\.timelineKey/,'a restored camera remounts the surface, which reads its camera once');
 assert.match(host,/className="research-timeline-view-save"[\s\S]*Save view/);
 assert.match(host,/aria-label="Saved timeline views"/,'the Views chooser is the Places grammar');
 assert.match(data,/styleCapability:\{available:true\}/,'the capability is available because the write mapping exists');
 assert.match(lens,/dataSource\.bindPresentation\?\.\(null\)/,'the lens releases its hold on unmount');
 assert.match(lens,/frameStateForNode\(store\.getState\(\)\.nodes,/,'a restored frame waits for its node to load');
 assert.match(lens,/store\.getState\(\)\.expandNode\(await dataSource\.expandNode\(ref\)\)/,'a working-set ref is re-read through the native owner');
});

test('the lens hook is provenance-admitted: the adapted hash in PROVENANCE is the file as it stands', ()=>{
 const manifest=JSON.parse(read(resolve(engine,'../vendor/research-canvas/PROVENANCE.json')));
 const path='packages/canvas/src/timeline/TimelineLens.tsx';
 const actual=createHash('sha256').update(readFileSync(resolve(timelineDir,'TimelineLens.tsx'))).digest('hex');
 assert.equal(manifest.patches[path].adapted_sha256,actual);
 assert.match(manifest.patches[path].reason,/lane-2 T15-T18: timeline views and style$/);
});
