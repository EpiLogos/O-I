/** Production placement over retained, actually authored native stress data.
 * Extra size/lane cases change only transient presentation, never dates/nodes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const artifact=process.env.OI_NATIVE_TIMELINE_PROOF;
test('all retained native Timeline dates have distinct collision-free card rectangles',{skip:!artifact?'Set OI_NATIVE_TIMELINE_PROOF to an actual native stress receipt':false},async()=>{
 const actual=JSON.parse(await readFile(artifact,'utf8'));assert.ok(actual.reading.temporal.length);assert.ok(actual.document.expression_ref);
 const compiled=await build({stdin:{contents:"export {readingInstruments} from './researchInstrumentsData.ts';export {projectNodes,placeItems,timelineCardBounds} from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';export {yearToPixel} from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const data=await api.readingInstruments(actual.reading),view=await data.dataSource.loadTimelineView(),items=api.projectNodes(view.nodes),source=JSON.stringify(actual);
 assert.equal(items.length,actual.counts.timeline_anchors);assert.ok(items.length>=192);
 const cases=[
  {label:'native overview',items,viewport:{centerYear:1000,pixelsPerYear:.02,widthPx:1200}},
  {label:'native century cluster',items,viewport:{centerYear:2000,pixelsPerYear:1,widthPx:1200}},
  {label:'native detail cluster',items,viewport:{centerYear:2000,pixelsPerYear:365.2425,widthPx:1200}},
  {label:'authored card dimensions and lane offsets',items:items.map((item,i)=>({...item,presentation:{...item.presentation,width:180+(i%5)*85,height:72+(i%4)*60,offsetY:(i%7-3)*43,lane:i%3===0?'one-authored-group':null}})),viewport:{centerYear:2000,pixelsPerYear:12,widthPx:1200}},
 ];
 for(const scenario of cases){
  const original=JSON.stringify(scenario.items),placed=api.placeItems(scenario.items,scenario.viewport,view.lanes),bounds=placed.map(api.timelineCardBounds);
  if(scenario.label==='native century cluster')assert.ok(bounds.every(b=>b.height===64),'century rectangles match actual compact card height');
  assert.equal(placed.length,items.length);assert.deepEqual(new Set(placed.map(p=>p.item.graphNodeId)),new Set(items.map(i=>i.graphNodeId)));
  for(let i=0;i<placed.length;i++){
   assert.equal(placed[i].startPx,api.yearToPixel(scenario.viewport,placed[i].item.startYear),'date coordinate is never displaced');
   for(let j=0;j<i;j++){
    const a=bounds[i],b=bounds[j];assert.ok(a.right+15.999<=b.left||b.right+15.999<=a.left||a.bottom+15.999<=b.top||b.bottom+15.999<=a.top,`${scenario.label}: ${placed[i].item.graphNodeId} overlaps ${placed[j].item.graphNodeId}`);
   }
  }
  assert.equal(JSON.stringify(scenario.items),original,'collision placement cannot mutate authored layout');
  assert.deepEqual(api.placeItems(scenario.items,scenario.viewport,view.lanes),placed,'identical data produces stable placement');
 }
 assert.equal(JSON.stringify(actual),source);
 console.log(JSON.stringify({artifact,nativeSubjects:actual.counts.native_subjects,datedCards:items.length,scenarios:cases.map(c=>c.label),proof:'exact date positions, no dropped cards, pairwise rectangles separated, source/layout unchanged'}));
});
